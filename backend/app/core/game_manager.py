import chess

games: dict[str, chess.Board] = {}


def get_or_create_game(game_id: str) -> chess.Board:
    existing = games.get(game_id)
    if existing is None or existing.is_game_over():
        games[game_id] = chess.Board()
    return games[game_id]


def game_exists(game_id: str) -> bool:
    return game_id in games and not games[game_id].is_game_over()


def reset_game(game_id: str) -> chess.Board:
    games[game_id] = chess.Board()
    return games[game_id]
