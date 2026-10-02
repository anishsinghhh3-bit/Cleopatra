import chess

from app.core.engine import get_candidates
from app.core.chess_features import is_sacrifice


def _extract_features(board: chess.Board, move: chess.Move, cp_loss: int) -> dict:
    board_after = board.copy()
    board_after.push(move)

    return {
        "cp_loss": cp_loss,
        "is_capture": board.is_capture(move),
        "gives_check": board_after.is_check(),
        "is_sacrifice": is_sacrifice(board, move),
        "opponent_mobility": len(list(board_after.legal_moves)),
    }


def _tal_score(f: dict) -> float:
    score = -0.5 * f["cp_loss"]
    score += 40 if f["is_sacrifice"] else 0
    score += 15 if f["is_capture"] else 0
    score += 10 if f["gives_check"] else 0
    score += 0.5 * f["opponent_mobility"]
    return score


def _fischer_score(f: dict) -> float:
    score = -2.0 * f["cp_loss"]
    score += 8 if f["is_capture"] else 0
    score += 8 if f["gives_check"] else 0
    if f["is_sacrifice"] and f["cp_loss"] < 30:
        score += 5
    score -= 0.3 * f["opponent_mobility"]
    return score


def _botvinnik_score(f: dict) -> float:
    score = -1.0 * f["cp_loss"]
    score -= 20 if f["is_sacrifice"] else 0
    score += 5 if f["is_capture"] else 0
    score -= 5 if f["gives_check"] else 0
    score -= 0.8 * f["opponent_mobility"]
    return score


def council_vote(fen: str) -> dict:
    board = chess.Board(fen)

    if board.is_game_over():
        return {"move": None, "candidates": [], "note": "Game is already over."}

    candidates = get_candidates(fen)
    best_score = max(score for _, score in candidates)

    results = []
    for move, score in candidates:
        cp_loss = best_score - score
        features = _extract_features(board, move, cp_loss)

        tal = _tal_score(features)
        fischer = _fischer_score(features)
        botvinnik = _botvinnik_score(features)

        results.append({
            "move": move.uci(),
            "cp_loss": cp_loss,
            "tal_score": round(tal, 2),
            "fischer_score": round(fischer, 2),
            "botvinnik_score": round(botvinnik, 2),
            "combined_score": round(tal + fischer + botvinnik, 2),
        })

    results.sort(key=lambda r: r["combined_score"], reverse=True)

    return {
        "move": results[0]["move"],
        "candidates": results,
    }
