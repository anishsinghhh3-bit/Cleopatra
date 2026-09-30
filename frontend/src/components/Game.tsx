import { useEffect, useRef, useState } from "react";
import Board from "./Board";
import { parseFen, getPieceAt } from "../lib/fen";

const GAME_ID = "demo";
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const COUNCIL = ["Tal", "Fischer", "Botvinnik"];

interface MoveRound {
  human: string;
  cleopatra: string | null;
}

interface LastMove {
  from: string;
  to: string;
}

export default function Game() {
  const [fen, setFen] = useState(STARTING_FEN);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [moves, setMoves] = useState<MoveRound[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingHumanMoveRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/game/${GAME_ID}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "error") {
        setError(data.message);
        setThinking(false);
        setSelected(null);
        return;
      }

      setError(null);
      setFen(data.fen);
      setGameOver(data.game_over);

      if (data.type === "human_move_applied") {
        setLastMove({ from: data.move.slice(0, 2), to: data.move.slice(2, 4) });
        if (data.game_over) {
          setMoves((prev) => [...prev, { human: data.move, cleopatra: null }]);
          setThinking(false);
        } else {
          pendingHumanMoveRef.current = data.move;
        }
        return;
      }

      if (data.type === "cleopatra_move") {
        setLastMove({ from: data.move.slice(0, 2), to: data.move.slice(2, 4) });
        setMoves((prev) => [...prev, { human: pendingHumanMoveRef.current ?? "", cleopatra: data.move }]);
        pendingHumanMoveRef.current = null;
        setThinking(false);
      }
    };

    ws.onerror = () => {
      setError("Couldn't reach the server. Is it running?");
    };

    return () => {
      ws.close();
    };
  }, []);

  function handleSquareClick(square: string) {
    if (thinking || gameOver) return;

    const grid = parseFen(fen);

    if (!selected) {
      const piece = getPieceAt(grid, square);
      if (piece && piece.color === "white") {
        setSelected(square);
      }
      return;
    }

    if (selected === square) {
      setSelected(null);
      return;
    }

    const movingPiece = getPieceAt(grid, selected);
    let uci = `${selected}${square}`;
    const reachesBackRank = square[1] === "8" || square[1] === "1";
    if (movingPiece?.type === "p" && reachesBackRank) {
      uci += "q";
    }

    wsRef.current?.send(JSON.stringify({ type: "move", uci }));
    setSelected(null);
    setThinking(true);
  }

  const statusText = gameOver ? "Game over." : thinking ? "Cleopatra is thinking\u2026" : "Your move.";

  return (
    <div className="min-h-screen bg-ink text-parchment font-sans">
      <header className="flex items-center justify-between border-b border-brass/20 px-8 py-5">
        <h1 className="font-display text-2xl tracking-tight">Cleopatra</h1>
        <span className="text-sm text-brass/80">Tempo &middot; 812</span>
      </header>

      <main className="flex flex-wrap items-start justify-center gap-12 px-8 py-12">
        <div>
          <p
            className={`mb-3 font-display text-lg ${
              gameOver ? "text-verdigris" : thinking ? "animate-pulse text-verdigris" : "text-parchment"
            }`}
          >
            {statusText}
          </p>
          <Board fen={fen} selectedSquare={selected} lastMove={lastMove} onSquareClick={handleSquareClick} />
          {error && <p className="mt-3 text-sm text-signal">{error}</p>}
        </div>

        <aside className="w-64 space-y-10">
          <section>
            <h2 className="font-display text-lg text-verdigris">Council</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {COUNCIL.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between border-b border-brass/10 pb-2"
                >
                  <span>{name}</span>
                  <span className={thinking ? "text-verdigris" : "text-brass/60"}>
                    {thinking ? "in session" : "quiet"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-verdigris">Moves</h2>
            {moves.length === 0 ? (
              <p className="mt-3 text-sm text-parchment/50">No moves yet.</p>
            ) : (
              <ol className="mt-3 space-y-1 text-sm tabular-nums">
                {moves.map((round, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-brass/50">{i + 1}.</span>
                    <span>{round.human}</span>
                    <span className="text-parchment">{round.cleopatra ?? ""}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
