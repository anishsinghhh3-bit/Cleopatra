CLEOPATRA_RATING = 2800
K_FACTOR = 32


def expected_score(player_rating: int, opponent_rating: int = CLEOPATRA_RATING) -> float:
    return 1 / (1 + 10 ** ((opponent_rating - player_rating) / 400))


def update_rating(player_rating: int, actual_score: float) -> int:
    """actual_score: 1 for a win, 0.5 for a draw, 0 for a loss, from the player's side."""
    expected = expected_score(player_rating)
    new_rating = player_rating + K_FACTOR * (actual_score - expected)
    return max(0, round(new_rating))


def coins_for_result(actual_score: float) -> int:
    return 5 if actual_score == 1.0 else 0
