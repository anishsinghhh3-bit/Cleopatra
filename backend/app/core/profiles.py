import os

import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]

HEADERS = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def get_profile(user_id: str) -> dict:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers=HEADERS,
        params={"id": f"eq.{user_id}", "select": "coins,rating,wins,legacy_points"},
        timeout=10,
    )
    response.raise_for_status()
    rows = response.json()
    if not rows:
        raise ValueError(f"No profile found for user {user_id}")
    return rows[0]


def update_profile(user_id: str, **fields) -> dict:
    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers=HEADERS,
        params={"id": f"eq.{user_id}"},
        json=fields,
        timeout=10,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else {}
