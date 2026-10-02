import os

import jwt
from dotenv import load_dotenv
from jwt import PyJWKClient

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
ISSUER = f"{SUPABASE_URL}/auth/v1"

_jwk_client = PyJWKClient(JWKS_URL)


def verify_token(token: str) -> dict:
    """Verify a Supabase access token and return its claims.
    Raises a jwt exception if the token is invalid, expired, or malformed."""
    signing_key = _jwk_client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256", "ES256"],
        audience="authenticated",
        issuer=ISSUER,
    )
