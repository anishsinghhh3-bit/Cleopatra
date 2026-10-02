import math

import chess
import chess.engine

from app.core.engine import ENGINE_PATH
from app.core.chess_features import is_sacrifice

ANALYSIS_TIME = 0.3


def _win_percent(centipawns: int) -> float:
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * centipawns)) - 1)


def _move_accuracy(win_before: float, win_after: float) -> float:
    win_diff = max(0.0, win_before - win_after)
    accuracy = 103.1668 * math.exp(-0.04354 * win_diff) - 3.1669
    return max(0.0, min(100.0, accuracy))


def _classify(win_diff: float, sacrifice: bool) -> str:
    if win_diff <= 1:
        return "Brilliant" if sacrifice else "Best"
    if win_diff <= 5:
        return "Good"
    if win_diff <= 10:
        return "Inaccuracy"
    if win_diff <= 20:
        return "Mistake"
    return "Blunder"


def _estimate_performance(accuracy: float) -> int:
    """Rough single-game performance estimate, linearly mapping accuracy to an
    Elo-like number. A deliberate v0 approximation, not a statistically derived
    rating model -- a real performance rating also depends on opponent strength."""
    return round(800 + (accuracy / 100) * 2000)


def generate_match_report(moves_uci: list[str]) -> dict:
    board = chess.Board()
    engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
    evaluations_cp: list[int] = []

    try:
        info = engine.analyse(board, chess.engine.Limit(time=ANALYSIS_TIME))
        evaluations_cp.append(info["score"].pov(chess.WHITE).score(mate_score=100000))

        for uci in moves_uci:
            board.push(chess.Move.from_uci(uci))

            if board.is_checkmate():
                # Whoever is "to move" here has just been checkmated and lost --
                # asking the engine to search a position with zero legal moves
                # is undefined, so we assign the terminal score directly instead.
                mated_side_is_white = board.turn == chess.WHITE
                evaluations_cp.append(-100000 if mated_side_is_white else 100000)
            elif board.is_game_over():
                evaluations_cp.append(0)
            else:
                info = engine.analyse(board, chess.engine.Limit(time=ANALYSIS_TIME))
                evaluations_cp.append(info["score"].pov(chess.WHITE).score(mate_score=100000))
    finally:
        engine.quit()

    win_percents = [_win_percent(cp) for cp in evaluations_cp]

    move_reports = []
    replay_board = chess.Board()

    for i, uci in enumerate(moves_uci):
        mover_is_white = (i % 2 == 0)
        move = chess.Move.from_uci(uci)

        win_before = win_percents[i] if mover_is_white else 100 - win_percents[i]
        win_after = win_percents[i + 1] if mover_is_white else 100 - win_percents[i + 1]
        win_diff = max(0.0, win_before - win_after)

        sacrifice = is_sacrifice(replay_board, move)
        accuracy = _move_accuracy(win_before, win_after)
        classification = _classify(win_diff, sacrifice)

        move_reports.append({
            "ply": i + 1,
            "move": uci,
            "mover": "white" if mover_is_white else "black",
            "eval_cp": evaluations_cp[i + 1],
            "win_diff": round(win_diff, 1),
            "accuracy": round(accuracy, 1),
            "classification": classification,
        })

        replay_board.push(move)

    white_moves = [m for m in move_reports if m["mover"] == "white"]
    black_moves = [m for m in move_reports if m["mover"] == "black"]

    white_accuracy = round(sum(m["accuracy"] for m in white_moves) / len(white_moves), 1) if white_moves else 100.0
    black_accuracy = round(sum(m["accuracy"] for m in black_moves) / len(black_moves), 1) if black_moves else 100.0

    significant = [m for m in move_reports if m["classification"] in ("Mistake", "Blunder")]
    turning_points = sorted(significant, key=lambda m: m["win_diff"], reverse=True)[:3]

    return {
        "moves": move_reports,
        "eval_graph": evaluations_cp,
        "white_accuracy": white_accuracy,
        "black_accuracy": black_accuracy,
        "white_performance": _estimate_performance(white_accuracy),
        "black_performance": _estimate_performance(black_accuracy),
        "turning_points": [
            {
                "ply": m["ply"],
                "move": m["move"],
                "classification": m["classification"],
                "explanation": (
                    f"{m['mover'].capitalize()} played {m['move']}, losing about "
                    f"{m['win_diff']:.0f} points of win probability."
                ),
            }
            for m in turning_points
        ],
    }
