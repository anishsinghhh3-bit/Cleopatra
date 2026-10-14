import os
import pathlib

import chess
import chess.engine

CORE_DIR = pathlib.Path(__file__).resolve().parent
BACKEND_DIR = CORE_DIR.parent.parent
# On the deployed Linux server the engine path comes from the STOCKFISH_PATH
# environment variable; locally it falls back to the Windows download.
ENGINE_PATH = os.environ.get("STOCKFISH_PATH") or str(BACKEND_DIR / "engine" / "stockfish.exe")

DEFAULT_ELO = 2800
MIN_SAFE_ELO = 1350
MAX_SAFE_ELO = 2850


def _safe_elo(elo: int) -> int:
    """Stockfish's UCI_Elo option only accepts a limited range; ratings in this
    app can in principle drift outside it (a very low-rated player, or a
    personal AI trained from one), so we clamp before handing the number to
    the engine rather than risk it rejecting the option outright."""
    return max(MIN_SAFE_ELO, min(MAX_SAFE_ELO, elo))


def get_best_move(fen: str, elo: int = DEFAULT_ELO, think_time: float = 1.0) -> str:
    board = chess.Board(fen)
    engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
    try:
        engine.configure({"UCI_LimitStrength": True, "UCI_Elo": _safe_elo(elo)})
        result = engine.play(board, chess.engine.Limit(time=think_time))
        return result.move.uci()
    finally:
        engine.quit()


def get_candidates(
    fen: str,
    count: int = 5,
    elo: int = DEFAULT_ELO,
    think_time: float = 1.0,
) -> list[tuple[chess.Move, int]]:
    board = chess.Board(fen)
    engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
    try:
        engine.configure({"UCI_LimitStrength": True, "UCI_Elo": _safe_elo(elo)})
        info_list = engine.analyse(board, chess.engine.Limit(time=think_time), multipv=count)
        candidates = []
        for info in info_list:
            move = info["pv"][0]
            score = info["score"].pov(board.turn).score(mate_score=100000)
            candidates.append((move, score))
        return candidates
    finally:
        engine.quit()
