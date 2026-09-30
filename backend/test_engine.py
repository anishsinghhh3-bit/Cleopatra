import chess
import chess.engine

engine = chess.engine.SimpleEngine.popen_uci("engine/stockfish.exe")
engine.configure({"UCI_LimitStrength": True, "UCI_Elo": 2800})

board = chess.Board()
result = engine.play(board, chess.engine.Limit(time=1.0))

print("Stockfish suggests:", result.move)
print("Legal moves from start:", len(list(board.legal_moves)))

engine.quit()
