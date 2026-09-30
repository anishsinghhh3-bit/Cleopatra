import chess


def get_legal_moves(fen: str) -> list[str]:
    """Return every legal move from this position, in UCI notation (e.g. 'e2e4')."""
    board = chess.Board(fen)
    return [move.uci() for move in board.legal_moves]
