import asyncio

_user_locks: dict[str, asyncio.Lock] = {}


def get_user_lock(user_id: str) -> asyncio.Lock:
    """One lock per user id, created on first use. Serializes concurrent writes
    to a single user's coins/rating/wins (e.g. two browser tabs racing to start
    a challenge at once) so a stale read can never produce a lost update.
    Scoped to a single server process -- revisit if this ever runs as more
    than one worker."""
    if user_id not in _user_locks:
        _user_locks[user_id] = asyncio.Lock()
    return _user_locks[user_id]
