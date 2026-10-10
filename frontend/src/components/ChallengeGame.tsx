import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Board from "./Board";
import MatchReportView from "./MatchReportView";
import type { MatchReport } from "./MatchReportView";
import { parseFen, getPieceAt } from "../lib/fen";
import { WS_BASE } from "../lib/config";
import { connectWithRetry } from "../lib/socket";
import type { SocketController, SocketStatus } from "../lib/socket";
import { createResyncer } from "../lib/resync";
import { pairMoves, awaitingOpponent } from "../lib/moves";
import type { MoveRound } from "../lib/moves";
import type { Profile } from "../lib/types";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const socketRef = useRef<SocketController | null>(null);
  const tokenRef = useRef(session.access_token);

  useEffect(() => {
    tokenRef.current = session.access_token;
  }, [session.access_token]);

  useEffect(() => {
    const resyncer = createResyncer(() => socketRef.current?.reconnect());

    function handleMessage(data: any) {
      if (data.type === "error") {
        setError(data.message);
        setThinking(false);
        return;
      }

      setError(null);
      if (data.fen) setFen(data.fen);
      if (data.game_over !== undefined) setGameOver(data.game_over);
      if (data.opponent_rating !== undefined) setOpponentRating(data.opponent_rating);

      if (Array.isArray(data.moves)) {
        setMoves(pairMoves(data.moves));
        const latest: string | undefined = data.moves[data.moves.length - 1];
        setLastMove(latest ? { from: latest.slice(0, 2), to: latest.slice(2, 4) } : null);
      }

      if (data.match_report) setMatchReport(data.match_report);

      if (data.challenge_result) {
        setChallengeResult(data.challenge_result);
        onProfileChange({
          rating: data.challenge_result.rating_after,
          coins: data.challenge_result.coins_total,
        });
      }

      if (data.type === "state") {
        if (awaitingOpponent(data)) {
          // Entered while the opponent's move was still being worked out;
          // check back until it lands.
          setThinking(true);
          resyncer.schedule(() => {
            setThinking(false);
            setError("The opponent isn't answering. Go back and re-enter this challenge from the Lobby.");
          });
        } else {
          setThinking(false);
          resyncer.reset();
        }
        return;
      }

      if (data.type === "human_move_applied") {
        setThinking(!data.game_over);
        return;
      }

      if (data.type === "opponent_move") {
        setThinking(false);
        resyncer.reset();
      }
    }

    // No automatic retry here on purpose: re-joining a challenge is a
    // deliberate action (it can involve the stake), so if the connection
    // drops we tell the player and let them re-enter from the Lobby.
    const controller = connectWithRetry(
      () => `${WS_BASE}/ws/challenge/${aiId}?token=${tokenRef.current}`,
      {
        onMessage: handleMessage,
        onStatus: setStatus,
        onFatalClose: (code) => {
          if (code === 4401) setError("Your session expired. Please log in again.");
        },
      },
      { shouldRetry: () => false }
    );
    socketRef.current = controller;

    return () => {
      resyncer.cancel();
      controller.close();
    };
  }, [aiId]);

  function handleSquareClick(square: string) {
    if (thinking || gameOver || status !== "open") return;

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

    setSelected(null);
    const sent = socketRef.current?.send({ type: "move", uci }) ?? false;
    if (!sent) {
      setError("Not connected. Go back and re-enter this challenge from the Lobby.");
      return;
    }
    setThinking(true);
  }

  const statusText = gameOver ? "Challenge over." : thinking ? "Opponent is thinking\u2026" : "Your move.";

  return (
    <div className="min-h-screen bg-ink text-parchment font-sans">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-brass/20 px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="font-display text-2xl tracking-tight">
          Challenge {opponentRating ? `\u00b7 ${opponentRating} rated` : ""}
        </h1>
        <button type="button" onClick={onBack} className="text-sm text-brass/70 underline">
          &larr; Back
        </button>
      </header>

      <main className="flex flex-wrap items-start justify-center gap-8 px-4 py-8 sm:gap-12 sm:px-8 sm:py-12">
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
            disabled={thinking || status !== "open"}
          />
          {status === "closed" && !gameOver && !error && (
            <p className="mt-3 text-sm text-signal">
              Connection lost. Tap Back, then re-enter this challenge from the Lobby to resume it.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-signal">{error}</p>}
        </div>

        <aside className="w-full sm:w-64">
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
                      <span className="text-parchment">{round.reply ?? ""}</span>
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
