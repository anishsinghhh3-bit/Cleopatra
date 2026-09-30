import chess

games: dict[str, chess.Board] = {}


def get_or_create_game(game_id: str) -> chess.Board:
    if game_id not in games:
        games[game_id] = chess.Board()
    return games[game_id]
