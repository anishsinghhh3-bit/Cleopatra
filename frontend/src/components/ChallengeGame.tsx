import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Board from "./Board";
import MatchReportView from "./MatchReportView";
import type { MatchReport } from "./MatchReportView";
import { parseFen, getPieceAt } from "../lib/fen";
import type { Profile } from "../lib/types";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface MoveRound {
  human: string;
  opponent: string | null;
}

interface LastMove {
  from: string;
  to: string;
}

interface ChallengeResult {
  result: string;
  rating_before: number;
  rating_after: number;
  coins_delta: number;
  coins_total: number;
  badge_earned: boolean;
}

interface ChallengeGameProps {
  session: Session;
  aiId: string;
  onProfileChange: (updates: Partial<Profile>) => void;
  onBack: () => void;
}

export default function ChallengeGame({ session, aiId, onProfileChange, onBack }: ChallengeGameProps) {
  const [fen, setFen] = useState(STARTING_FEN);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [moves, setMoves] = useState<MoveRound[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [opponentRating, setOpponentRating] = useState<number | null>(null);
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null);
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingHumanMoveRef = useRef<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/challenge/${aiId}?token=${session.access_token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "error") {
        setError(data.message);
        setThinking(false);
        return;
      }

      setError(null);
      if (data.fen) setFen(data.fen);
      if (data.game_over !== undefined) setGameOver(data.game_over);
      if (data.opponent_rating !== undefined) setOpponentRating(data.opponent_rating);
      if (data.match_report) setMatchReport(data.match_report);
      if (data.challenge_result) {
        setChallengeResult(data.challenge_result);
        onProfileChange({
          rating: data.challenge_result.rating_after,
          coins: data.challenge_result.coins_total,
        });
      }

      if (data.type === "human_move_applied") {
        setLastMove({ from: data.move.slice(0, 2), to: data.move.slice(2, 4) });
        if (data.game_over) {
          setMoves((prev) => [...prev, { human: data.move, opponent: null }]);
          setThinking(false);
        } else {
          pendingHumanMoveRef.current = data.move;
        }
        return;
      }

      if (data.type === "opponent_move") {
        setLastMove({ from: data.move.slice(0, 2), to: data.move.slice(2, 4) });
        setMoves((prev) => [...prev, { human: pendingHumanMoveRef.current ?? "", opponent: data.move }]);
        pendingHumanMoveRef.current = null;
        setThinking(false);
      }
    };

    ws.onerror = () => setError("Couldn't reach the server. Is it running?");

    return () => ws.close();
  }, [aiId, session.access_token]);

  function handleSquareClick(square: string) {
    if (thinking || gameOver) return;

    const grid = parseFen(fen);

    if (!selected) {
      const piece = getPieceAt(grid, square);
      if (piece && piece.color === "white") setSelected(square);
      return;
    }

    if (selected === square) {
      setSelected(null);
      return;
    }

    const movingPiece = getPieceAt(grid, selected);
    let uci = `${selected}${square}`;
    const reachesBackRank = square[1] === "8" || square[1] === "1";
    if (movingPiece?.type === "p" && reachesBackRank) uci += "q";

    wsRef.current?.send(JSON.stringify({ type: "move", uci }));
    setSelected(null);
    setThinking(true);
  }

  const statusText = gameOver ? "Challenge over." : thinking ? "Opponent is thinking\u2026" : "Your move.";

  return (
    <div className="min-h-screen bg-ink text-parchment font-sans">
      <header className="flex items-center justify-between border-b border-brass/20 px-8 py-5">
        <h1 className="font-display text-2xl tracking-tight">
          Challenge {opponentRating ? `\u00b7 ${opponentRating} rated` : ""}
        </h1>
        <button type="button" onClick={onBack} className="text-sm text-brass/70 underline">
          &larr; Back
        </button>
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
          <Board
            fen={fen}
            selectedSquare={selected}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            disabled={thinking}
          />
          {error && <p className="mt-3 text-sm text-signal">{error}</p>}
        </div>

        <aside className="w-64">
          {challengeResult && (
            <div className="mb-6 border border-brass/30 bg-surface p-4 text-sm">
              <p className="font-display text-base text-verdigris">
                {challengeResult.result === "win"
                  ? "Victory."
                  : challengeResult.result === "loss"
                  ? "Defeat."
                  : "Draw."}
              </p>
              <p className="mt-1 text-parchment/80">
                Rating: {challengeResult.rating_before} &rarr; {challengeResult.rating_after}
              </p>
              <p className={challengeResult.coins_delta >= 0 ? "text-brass" : "text-signal"}>
                {challengeResult.coins_delta >= 0 ? "+" : ""}
                {challengeResult.coins_delta} coins
              </p>
              {challengeResult.badge_earned && <p className="mt-1 text-verdigris">AI Slayer badge earned.</p>}
            </div>
          )}

          {matchReport ? (
            <MatchReportView report={matchReport} />
          ) : (
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
                      <span className="text-parchment">{round.opponent ?? ""}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
