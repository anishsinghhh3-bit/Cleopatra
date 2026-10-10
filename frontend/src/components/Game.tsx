import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Board from "./Board";
import MatchReportView from "./MatchReportView";
import type { MatchReport } from "./MatchReportView";
import { parseFen, getPieceAt } from "../lib/fen";
import { supabase } from "../lib/supabase";
import { leagueForRating, formatLeague } from "../lib/league";
import { WS_BASE } from "../lib/config";
import { connectWithRetry } from "../lib/socket";
import type { SocketController, SocketStatus } from "../lib/socket";
import { createResyncer } from "../lib/resync";
import { pairMoves, awaitingOpponent } from "../lib/moves";
import type { MoveRound } from "../lib/moves";
import type { Profile } from "../lib/types";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const COUNCIL = ["Tal", "Fischer", "Botvinnik"];

interface LastMove {
  from: string;
  to: string;
}

interface GameResult {
  result: string;
  rating_before: number;
  rating_after: number;
  coins_earned: number;
  coins_total: number;
}

interface GameProps {
  session: Session;
  profile: Profile | null;
  onProfileChange: (updates: Partial<Profile>) => void;
  onNavigateLegacy: () => void;
}

export default function Game({ session, profile, onProfileChange, onNavigateLegacy }: GameProps) {
  const [fen, setFen] = useState(STARTING_FEN);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [moves, setMoves] = useState<MoveRound[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const socketRef = useRef<SocketController | null>(null);
  const gameOverRef = useRef(false);
  const tokenRef = useRef(session.access_token);

  // Keep the freshest login token handy: the connection itself stays up when
  // the token refreshes, and any later reconnect uses the new one.
  useEffect(() => {
    tokenRef.current = session.access_token;
  }, [session.access_token]);

  useEffect(() => {
    const resyncer = createResyncer(() => socketRef.current?.reconnect());

    function handleMessage(data: any) {
      if (data.type === "error") {
        setError(data.message);
        setThinking(false);
        setSelected(null);
        return;
      }

      setError(null);
      setFen(data.fen);
      setGameOver(data.game_over);
      gameOverRef.current = data.game_over;

      // The server is the source of truth for the move list, so it stays
      // correct across reconnects, remounts, and "Play again".
      if (Array.isArray(data.moves)) {
        setMoves(pairMoves(data.moves));
        const latest: string | undefined = data.moves[data.moves.length - 1];
        setLastMove(latest ? { from: latest.slice(0, 2), to: latest.slice(2, 4) } : null);
      }

      if (data.match_report) {
        setMatchReport(data.match_report);
      }

      if (data.game_result) {
        setGameResult(data.game_result);
        onProfileChange({ rating: data.game_result.rating_after, coins: data.game_result.coins_total });
      }

      if (data.type === "state") {
        if (!data.game_over) {
          // A fresh game has replaced any finished one.
          setMatchReport(null);
          setGameResult(null);
        }
        if (awaitingOpponent(data)) {
          // We (re)connected while Cleopatra's move was still being worked
          // out; check back until it lands.
          setThinking(true);
          resyncer.schedule(() => {
            setThinking(false);
            setError("Cleopatra isn't answering. Check that the server is running, then reopen the app.");
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

      if (data.type === "cleopatra_move") {
        setThinking(false);
        resyncer.reset();
      }
    }

    const controller = connectWithRetry(
      () => `${WS_BASE}/ws/game?token=${tokenRef.current}`,
      {
        onMessage: handleMessage,
        onStatus: setStatus,
        onFatalClose: (code) => {
          if (code === 4401) setError("Your session expired. Please log in again.");
        },
      },
      { shouldRetry: () => !gameOverRef.current }
    );
    socketRef.current = controller;

    return () => {
      resyncer.cancel();
      controller.close();
    };
  }, []);

  function handleSquareClick(square: string) {
    if (thinking || gameOver || status !== "open") return;

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

    setSelected(null);
    const sent = socketRef.current?.send({ type: "move", uci }) ?? false;
    if (!sent) {
      setError("Not connected yet. Try again in a moment.");
      return;
    }
    setThinking(true);
  }

  function handleNewGame() {
    setMoves([]);
    setMatchReport(null);
    setGameResult(null);
    setLastMove(null);
    setSelected(null);
    setError(null);
    gameOverRef.current = false;
    // If the connection already dropped after the game ended, reconnecting
    // is enough: the server starts a fresh game for a finished one.
    const sent = socketRef.current?.send({ type: "new_game" }) ?? false;
    if (!sent) socketRef.current?.reconnect();
  }

  const statusText = gameOver ? "Game over." : thinking ? "Cleopatra is thinking\u2026" : "Your move.";

  return (
    <div className="min-h-screen bg-ink text-parchment font-sans">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-brass/20 px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="font-display text-2xl tracking-tight">Cleopatra</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm text-brass/80">
            {profile
              ? `${formatLeague(leagueForRating(profile.rating + profile.legacy_points))} \u00b7 ${profile.rating} \u00b7 ${profile.coins} coins${profile.badge_ai_slayer ? " \u00b7 \u2694 AI Slayer" : ""}`
              : "\u2026"}
          </span>
          <button type="button" onClick={onNavigateLegacy} className="text-sm text-brass/60 underline">
            Legacy AI
          </button>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-brass/60 underline"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="flex flex-wrap items-start justify-center gap-8 px-4 py-8 sm:gap-12 sm:px-8 sm:py-12">
        <div>
          <div className="mb-3 flex items-center gap-4">
            <p
              className={`font-display text-lg ${
                gameOver ? "text-verdigris" : thinking ? "animate-pulse text-verdigris" : "text-parchment"
              }`}
            >
              {statusText}
            </p>
            {gameOver && (
              <button
                type="button"
                onClick={handleNewGame}
                className="bg-verdigris px-3 py-1 text-xs font-medium text-ink"
              >
                Play again
              </button>
            )}
          </div>
          <Board
            fen={fen}
            selectedSquare={selected}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            disabled={thinking || status !== "open"}
          />
          {status === "reconnecting" && !thinking && (
            <p className="mt-3 text-sm text-brass">Connection lost. Reconnecting&hellip;</p>
          )}
          {error && <p className="mt-3 text-sm text-signal">{error}</p>}
        </div>

        <aside className="w-full sm:w-64">
          {gameResult && (
            <div className="mb-6 border border-brass/30 bg-surface p-4 text-sm">
              <p className="font-display text-base text-verdigris">
                {gameResult.result === "win" ? "Victory." : gameResult.result === "loss" ? "Defeat." : "Draw."}
              </p>
              <p className="mt-1 text-parchment/80">
                Rating: {gameResult.rating_before} &rarr; {gameResult.rating_after}
              </p>
              {gameResult.coins_earned > 0 && (
                <p className="text-brass">+{gameResult.coins_earned} coins</p>
              )}
            </div>
          )}

          {matchReport ? (
            <MatchReportView report={matchReport} />
          ) : (
            <div className="space-y-10">
              <section>
                <h2 className="font-display text-lg text-verdigris">Council</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {COUNCIL.map((name) => (
                    <li key={name} className="flex items-center justify-between border-b border-brass/10 pb-2">
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
                        <span className="text-parchment">{round.reply ?? ""}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
