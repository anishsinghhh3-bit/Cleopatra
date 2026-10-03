import os

import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def generate_commentary(prompt: str) -> str:
    """Call the configured LLM provider and return its text response.
    Currently backed by Groq; swapping to Gemini or OpenRouter later only
    requires changing this one function's body, not any of its callers."""
    if not GROQ_API_KEY:
        return "(Coach mode is not configured -- missing GROQ_API_KEY.)"

    try:
        response = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.6,
                "max_tokens": 150,
            },
            timeout=20,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except requests.RequestException:
        return "(Coach commentary unavailable right now.)"


def _build_prompt(turning_point: dict) -> str:
    return (
        "You are a chess coach with Bobby Fischer's direct, precise teaching style. "
        "In 2-3 sentences, explain to a club player why this move was a "
        f"{turning_point['classification'].lower()}, and what the better idea was. "
        "Plain language, standard algebraic notation only, be concrete not generic.\n\n"
        f"Position: move {turning_point['ply']}, {turning_point['mover']} to move.\n"
        f"Move played: {turning_point['move']}\n"
        f"Engine's recommended move instead: {turning_point['best_move'] or 'unavailable'}\n"
        f"This move lost about {turning_point['win_diff']:.0f} points of win probability."
    )


def add_commentary(report: dict) -> dict:
    """Enrich each turning point's explanation with real LLM narration,
    replacing the templated one-liner from the deterministic report."""
    for tp in report["turning_points"]:
        tp["explanation"] = generate_commentary(_build_prompt(tp))
    return report
