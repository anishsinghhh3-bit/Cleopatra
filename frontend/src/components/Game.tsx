import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Board from "./Board";
import MatchReportView from "./MatchReportView";
import type { MatchReport } from "./MatchReportView";
import { parseFen, getPieceAt } from "../lib/fen";
import { supabase } from "../lib/supabase";
import { leagueForRating, formatLeague } from "../lib/league";

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

interface Profile {
  username: string;
  rating: number;
  coins: number;
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
}

export default function Game({ session }: GameProps) {
  const [fen, setFen] = useState(STARTING_FEN);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [moves, setMoves] = useState<MoveRound[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matchReport, setMatchReport] = useState<MatchReport | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingHumanMoveRef = useRef<string | null>(null);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("username, rating, coins")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  }, [session.user.id]);

  useEffect(() => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/game?token=${session.access_token}`);
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

      if (data.match_report) {
        setMatchReport(data.match_report);
      }

      if (data.game_result) {
        setGameResult(data.game_result);
        setProfile((prev) =>
          prev ? { ...prev, rating: data.game_result.rating_after, coins: data.game_result.coins_total } : prev
        );
      }

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

    ws.onclose = (event) => {
      if (event.code === 4401) {
        setError("Your session expired. Please log in again.");
      }
    };

    return () => {
      ws.close();
    };
  }, [session.access_token]);

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
        <div className="flex items-center gap-4">
          <span className="text-sm text-brass/80">
            {profile
              ? `${formatLeague(leagueForRating(profile.rating))} \u00b7 ${profile.rating} \u00b7 ${profile.coins} coins`
              : "\u2026"}
          </span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-brass/60 underline"
          >
            Log out
          </button>
        </div>
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

        <aside className="w-64">
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
                        <span className="text-parchment">{round.cleopatra ?? ""}</span>
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
