import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess

from app.core.chess_rules import get_legal_moves
from app.core.engine import get_best_move
from app.core.council import council_vote
from app.core.game_manager import get_or_create_game, game_exists, reset_game
from app.core.auth import verify_token
from app.core.match_report import generate_match_report
from app.core.coach import add_commentary
from app.core.profiles import get_profile, update_profile
from app.core.rating import update_rating, coins_for_result, legacy_points_delta
from app.core.locks import get_user_lock
from app.core.personal_ai import (
    get_personal_ai,
    get_personal_ai_by_id,
    create_personal_ai,
    retrain_personal_ai,
    list_personal_ais,
    adjust_ai_bank,
    is_on_cooldown,
    record_challenge,
    WINS_REQUIRED,
    CHALLENGE_STAKE,
    RATING_BAND,
)

app = FastAPI(title="Cleopatra API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://localhost", "https://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    token = authorization.removeprefix("Bearer ")
    try:
        return verify_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class FenRequest(BaseModel):
    fen: str = chess.STARTING_FEN


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/legal-moves")
def legal_moves(request: FenRequest):
    return {"moves": get_legal_moves(request.fen)}


@app.post("/engine/bestmove")
def engine_bestmove(request: FenRequest):
    return {"move": get_best_move(request.fen)}


@app.post("/council/move")
def council_move(request: FenRequest):
    return council_vote(request.fen)


@app.get("/personal-ai/mine")
def my_personal_ai(claims: dict = Depends(get_current_user)):
    user_id = claims["sub"]
    ai = get_personal_ai(user_id)
    profile = get_profile(user_id)
    return {"ai": ai, "wins_required": WINS_REQUIRED, "wins": profile.get("wins", 0)}


@app.post("/personal-ai/create")
def create_my_personal_ai(claims: dict = Depends(get_current_user)):
    user_id = claims["sub"]

    if get_personal_ai(user_id) is not None:
        raise HTTPException(status_code=400, detail="You already have a personal AI.")

    profile = get_profile(user_id)
    wins = profile.get("wins", 0)
    if wins < WINS_REQUIRED:
        raise HTTPException(
            status_code=400,
            detail=f"You need {WINS_REQUIRED} wins to create a personal AI (you have {wins}).",
        )

    return create_personal_ai(user_id, profile["rating"])


@app.post("/personal-ai/retrain")
def retrain_my_personal_ai(claims: dict = Depends(get_current_user)):
    user_id = claims["sub"]
    ai = get_personal_ai(user_id)
    if ai is None:
        raise HTTPException(status_code=400, detail="You don't have a personal AI yet.")

    profile = get_profile(user_id)
    return retrain_personal_ai(ai["id"], profile["rating"])


@app.get("/personal-ai/lobby")
def personal_ai_lobby(claims: dict = Depends(get_current_user)):
    return {"ais": list_personal_ais(exclude_owner_id=claims["sub"])}


def _outcome_result(board: chess.Board) -> str | None:
    outcome = board.outcome()
    return outcome.result() if outcome else None


def _state_payload(board: chess.Board) -> dict:
    return {
        "fen": board.fen(),
        "turn": "white" if board.turn else "black",
        "game_over": board.is_game_over(),
        "result": _outcome_result(board),
    }


async def _build_report(board: chess.Board) -> dict:
    move_list = [m.uci() for m in board.move_stack]
    report = await asyncio.to_thread(generate_match_report, move_list)
    report = await asyncio.to_thread(add_commentary, report)
    return report


async def _apply_move_or_error(websocket: WebSocket, board: chess.Board, data: dict) -> str | None:
    uci = data.get("uci", "")
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        await websocket.send_json({"type": "error", "message": f"'{uci}' is not a valid UCI move."})
        return None

    if move not in board.legal_moves:
        await websocket.send_json({"type": "error", "message": f"'{uci}' is not legal here."})
        return None

    board.push(move)
    return uci


async def _apply_game_result(user_id: str, board: chess.Board) -> dict | None:
    outcome = board.outcome()
    if outcome is None:
        return None

    if outcome.winner is None:
        actual_score, result = 0.5, "draw"
    elif outcome.winner == chess.WHITE:
        actual_score, result = 1.0, "win"
    else:
        actual_score, result = 0.0, "loss"

    async with get_user_lock(user_id):
        profile = await asyncio.to_thread(get_profile, user_id)
        new_rating = update_rating(profile["rating"], actual_score)
        coins_earned = coins_for_result(actual_score)
        new_coins = profile["coins"] + coins_earned
        new_wins = profile.get("wins", 0) + (1 if actual_score == 1.0 else 0)

        await asyncio.to_thread(update_profile, user_id, rating=new_rating, coins=new_coins, wins=new_wins)

    return {
        "result": result,
        "rating_before": profile["rating"],
        "rating_after": new_rating,
        "coins_earned": coins_earned,
        "coins_total": new_coins,
        "wins_total": new_wins,
    }


async def _apply_challenge_result(challenger_id: str, ai: dict, board: chess.Board) -> dict | None:
    outcome = board.outcome()
    if outcome is None:
        return None

    if outcome.winner is None:
        actual_score, result = 0.5, "draw"
    elif outcome.winner == chess.WHITE:
        actual_score, result = 1.0, "win"
    else:
        actual_score, result = 0.0, "loss"

    async with get_user_lock(challenger_id):
        challenger_profile = await asyncio.to_thread(get_profile, challenger_id)

        new_challenger_rating = update_rating(challenger_profile["rating"], actual_score, ai["strength_rating"])

        bank_delta = 0
        stored_coins_change = 0  # applied on top of the already-staked balance
        net_coins_change = 0     # relative to the balance BEFORE the stake -- what the UI shows
        badge_earned = False
        new_wins = challenger_profile.get("wins", 0)

        if actual_score == 1.0:
            stored_coins_change = CHALLENGE_STAKE * 2
            net_coins_change = CHALLENGE_STAKE
            bank_delta = -CHALLENGE_STAKE
            badge_earned = True
            new_wins += 1
        elif actual_score == 0.0:
            net_coins_change = -CHALLENGE_STAKE
            bank_delta = CHALLENGE_STAKE
        else:
            stored_coins_change = CHALLENGE_STAKE

        new_coins = challenger_profile["coins"] + stored_coins_change
        updates = {"rating": new_challenger_rating, "coins": new_coins, "wins": new_wins}
        if badge_earned:
            updates["badge_ai_slayer"] = True
        await asyncio.to_thread(update_profile, challenger_id, **updates)

    if bank_delta != 0:
        await asyncio.to_thread(adjust_ai_bank, ai["id"], bank_delta)

    if actual_score != 0.5:
        owner_profile = await asyncio.to_thread(get_profile, ai["owner_id"])
        ai_won = actual_score == 0.0
        new_owner_legacy_points = owner_profile["legacy_points"] + legacy_points_delta(ai_won)
        await asyncio.to_thread(update_profile, ai["owner_id"], legacy_points=new_owner_legacy_points)

    await asyncio.to_thread(record_challenge, challenger_id, ai["id"], actual_score == 1.0)

    return {
        "result": result,
        "rating_before": challenger_profile["rating"],
        "rating_after": new_challenger_rating,
        "coins_delta": net_coins_change,
        "coins_total": new_coins,
        "badge_earned": badge_earned,
    }


@app.websocket("/ws/game")
async def play_game(websocket: WebSocket):
    await websocket.accept()

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return

    try:
        claims = verify_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    game_id = claims["sub"]
    board = get_or_create_game(game_id)

    await websocket.send_json({"type": "state", **_state_payload(board)})

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "new_game":
                if not board.is_game_over():
                    await websocket.send_json({"type": "error", "message": "Finish the current game first."})
                    continue
                board = reset_game(game_id)
                await websocket.send_json({"type": "state", **_state_payload(board)})
                continue

            if msg_type != "move":
                await websocket.send_json({"type": "error", "message": "Unknown message type."})
                continue

            uci = await _apply_move_or_error(websocket, board, data)
            if uci is None:
                continue

            human_payload = {"type": "human_move_applied", "move": uci, **_state_payload(board)}
            if board.is_game_over():
                human_payload["match_report"] = await _build_report(board)
                human_payload["game_result"] = await _apply_game_result(game_id, board)
            await websocket.send_json(human_payload)

            if board.is_game_over():
                continue

            cleopatra_result = await asyncio.to_thread(council_vote, board.fen())
            cleopatra_uci = cleopatra_result["move"]
            board.push(chess.Move.from_uci(cleopatra_uci))

            cleopatra_payload = {"type": "cleopatra_move", "move": cleopatra_uci, **_state_payload(board)}
            if board.is_game_over():
                cleopatra_payload["match_report"] = await _build_report(board)
                cleopatra_payload["game_result"] = await _apply_game_result(game_id, board)
            await websocket.send_json(cleopatra_payload)

    except WebSocketDisconnect:
        pass


@app.websocket("/ws/challenge/{ai_id}")
async def play_challenge(websocket: WebSocket, ai_id: str):
    await websocket.accept()

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return

    try:
        claims = verify_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    challenger_id = claims["sub"]

    ai = await asyncio.to_thread(get_personal_ai_by_id, ai_id)
    if ai is None:
        await websocket.send_json({"type": "error", "message": "That AI doesn't exist."})
        await websocket.close(code=4404)
        return

    if ai["owner_id"] == challenger_id:
        await websocket.send_json({"type": "error", "message": "You can't challenge your own AI."})
        await websocket.close(code=4400)
        return

    game_id = f"challenge:{challenger_id}:{ai_id}"
    is_new_challenge = not game_exists(game_id)

    if is_new_challenge:
        owner_profile = await asyncio.to_thread(get_profile, ai["owner_id"])

        async with get_user_lock(challenger_id):
            challenger_profile = await asyncio.to_thread(get_profile, challenger_id)

            if abs(challenger_profile["rating"] - owner_profile["rating"]) > RATING_BAND:
                await websocket.send_json({
                    "type": "error",
                    "message": f"This AI is outside your rating range (owner is {owner_profile['rating']}, you're {challenger_profile['rating']}).",
                })
                await websocket.close(code=4403)
                return

            if await asyncio.to_thread(is_on_cooldown, challenger_id, ai_id):
                await websocket.send_json({"type": "error", "message": "You've already challenged this AI in the last 24 hours."})
                await websocket.close(code=4403)
                return

            if challenger_profile["coins"] < CHALLENGE_STAKE:
                await websocket.send_json({"type": "error", "message": f"You need at least {CHALLENGE_STAKE} coins to challenge."})
                await websocket.close(code=4402)
                return

            await asyncio.to_thread(update_profile, challenger_id, coins=challenger_profile["coins"] - CHALLENGE_STAKE)

    board = get_or_create_game(game_id)

    await websocket.send_json({
        "type": "state",
        "opponent_rating": ai["strength_rating"],
        "stake": CHALLENGE_STAKE,
        **_state_payload(board),
    })

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "move":
                await websocket.send_json({"type": "error", "message": "Unknown message type."})
                continue

            uci = await _apply_move_or_error(websocket, board, data)
            if uci is None:
                continue

            human_payload = {"type": "human_move_applied", "move": uci, **_state_payload(board)}
            if board.is_game_over():
                human_payload["match_report"] = await _build_report(board)
                human_payload["challenge_result"] = await _apply_challenge_result(challenger_id, ai, board)
            await websocket.send_json(human_payload)

            if board.is_game_over():
                continue

            ai_uci = await asyncio.to_thread(get_best_move, board.fen(), ai["strength_rating"])
            board.push(chess.Move.from_uci(ai_uci))

            ai_payload = {"type": "opponent_move", "move": ai_uci, **_state_payload(board)}
            if board.is_game_over():
                ai_payload["match_report"] = await _build_report(board)
                ai_payload["challenge_result"] = await _apply_challenge_result(challenger_id, ai, board)
            await websocket.send_json(ai_payload)

    except WebSocketDisconnect:
        pass

