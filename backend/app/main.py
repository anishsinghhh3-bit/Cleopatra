from fastapi import FastAPI
from pydantic import BaseModel
import chess

from app.core.chess_rules import get_legal_moves
from app.core.engine import get_best_move
from app.core.council import council_vote

app = FastAPI(title="Cleopatra API")


class FenRequest(BaseModel):
    fen: str = chess.STARTING_FEN


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/legal-moves")
def legal_moves(request: FenRequest):
    return {"moves": get_legal_moves(request.fen)}


@app.post("/engine/bestmove")
def engine_bestmove(request: FenRequest):
    return {"move": get_best_move(request.fen)}


@app.post("/council/move")
def council_move(request: FenRequest):
    return council_vote(request.fen)
