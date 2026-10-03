import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess

from app.core.chess_rules import get_legal_moves
from app.core.engine import get_best_move
from app.core.council import council_vote
from app.core.game_manager import get_or_create_game
from app.core.auth import verify_token
from app.core.match_report import generate_match_report
from app.core.coach import add_commentary

app = FastAPI(title="Cleopatra API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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

            if data.get("type") != "move":
                await websocket.send_json({"type": "error", "message": "Unknown message type."})
                continue

            uci = data.get("uci", "")
            try:
                move = chess.Move.from_uci(uci)
            except ValueError:
                await websocket.send_json({"type": "error", "message": f"'{uci}' is not a valid UCI move."})
                continue

            if move not in board.legal_moves:
                await websocket.send_json({"type": "error", "message": f"'{uci}' is not legal here."})
                continue

            board.push(move)

            human_payload = {
                "type": "human_move_applied",
                "move": uci,
                **_state_payload(board),
            }
            if board.is_game_over():
                human_payload["match_report"] = await _build_report(board)
            await websocket.send_json(human_payload)

            if board.is_game_over():
                continue

            cleopatra_result = await asyncio.to_thread(council_vote, board.fen())
            cleopatra_uci = cleopatra_result["move"]
            board.push(chess.Move.from_uci(cleopatra_uci))

            cleopatra_payload = {
                "type": "cleopatra_move",
                "move": cleopatra_uci,
                **_state_payload(board),
            }
            if board.is_game_over():
                cleopatra_payload["match_report"] = await _build_report(board)
            await websocket.send_json(cleopatra_payload)

    except WebSocketDisconnect:
        pass
