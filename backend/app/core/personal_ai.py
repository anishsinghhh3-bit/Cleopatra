import datetime
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

WINS_REQUIRED = 5
STARTING_BANK = 100
CHALLENGE_STAKE = 20
RATING_BAND = 200
COOLDOWN_HOURS = 24


def get_personal_ai(owner_id: str) -> dict | None:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/personal_ais",
        headers=HEADERS,
        params={"owner_id": f"eq.{owner_id}", "select": "*"},
        timeout=10,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def get_personal_ai_by_id(ai_id: str) -> dict | None:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/personal_ais",
        headers=HEADERS,
        params={"id": f"eq.{ai_id}", "select": "*"},
        timeout=10,
    )
    response.raise_for_status()
    rows = response.json()
    return rows[0] if rows else None


def create_personal_ai(owner_id: str, strength_rating: int) -> dict:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/personal_ais",
        headers=HEADERS,
        json={"owner_id": owner_id, "strength_rating": strength_rating, "bank": STARTING_BANK},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()[0]


def retrain_personal_ai(ai_id: str, strength_rating: int) -> dict:
    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/personal_ais",
        headers=HEADERS,
        params={"id": f"eq.{ai_id}"},
        json={
            "strength_rating": strength_rating,
            "retrained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()[0]


def list_personal_ais(exclude_owner_id: str | None = None, limit: int = 20) -> list[dict]:
    params = {
        "select": "id,owner_id,strength_rating,bank,created_at,profiles(username,rating)",
        "order": "bank.desc",
        "limit": str(limit),
    }
    if exclude_owner_id:
        params["owner_id"] = f"neq.{exclude_owner_id}"

    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/personal_ais",
        headers=HEADERS,
        params=params,
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def adjust_ai_bank(ai_id: str, delta: int) -> dict:
    ai = get_personal_ai_by_id(ai_id)
    new_bank = max(0, ai["bank"] + delta)
    response = requests.patch(
        f"{SUPABASE_URL}/rest/v1/personal_ais",
        headers=HEADERS,
        params={"id": f"eq.{ai_id}"},
        json={"bank": new_bank},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()[0]


def is_on_cooldown(challenger_id: str, ai_id: str) -> bool:
    cutoff = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=COOLDOWN_HOURS)).isoformat()
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/challenge_log",
        headers=HEADERS,
        params={
            "challenger_id": f"eq.{challenger_id}",
            "ai_id": f"eq.{ai_id}",
            "challenged_at": f"gte.{cutoff}",
            "select": "id",
            "limit": "1",
        },
        timeout=10,
    )
    response.raise_for_status()
    return len(response.json()) > 0


def record_challenge(challenger_id: str, ai_id: str, challenger_won: bool) -> None:
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/challenge_log",
        headers=HEADERS,
        json={"challenger_id": challenger_id, "ai_id": ai_id, "challenger_won": challenger_won},
        timeout=10,
    )
    response.raise_for_status()
