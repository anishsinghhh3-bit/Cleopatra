import pathlib

import chess
import chess.engine

CORE_DIR = pathlib.Path(__file__).resolve().parent
BACKEND_DIR = CORE_DIR.parent.parent
ENGINE_PATH = str(BACKEND_DIR / "engine" / "stockfish.exe")

DEFAULT_ELO = 2800


def get_best_move(fen: str, elo: int = DEFAULT_ELO, think_time: float = 1.0) -> str:
    """Ask Stockfish, capped to a human-elite Elo, for its best move in this position."""
    board = chess.Board(fen)
    engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
    try:
        engine.configure({"UCI_LimitStrength": True, "UCI_Elo": elo})
        result = engine.play(board, chess.engine.Limit(time=think_time))
        return result.move.uci()
    finally:
        engine.quit()
