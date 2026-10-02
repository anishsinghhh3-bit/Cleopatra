import chess

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}


def piece_value(board: chess.Board, square: int) -> int:
    piece = board.piece_at(square)
    if piece is None:
        return 0
    return PIECE_VALUES[piece.piece_type]


def is_sacrifice(board: chess.Board, move: chess.Move) -> bool:
    """Heuristic: did this move give up more material on its destination square
    than it captured, while leaving that square under attack?"""
    mover_value = piece_value(board, move.from_square)
    captured_value = piece_value(board, move.to_square) if board.is_capture(move) else 0

    board_after = board.copy()
    board_after.push(move)

    opponent = board_after.turn
    if not board_after.attackers(opponent, move.to_square):
        return False

    return (mover_value - captured_value) > 1
