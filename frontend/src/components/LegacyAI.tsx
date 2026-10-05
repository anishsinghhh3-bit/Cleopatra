import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

const API_BASE = "http://127.0.0.1:8000";

interface PersonalAI {
  id: string;
  strength_rating: number;
  bank: number;
  retrained_at: string;
}

interface LobbyEntry {
  id: string;
  strength_rating: number;
  bank: number;
  profiles: { username: string; rating: number } | null;
}

interface LegacyAIProps {
  session: Session;
  visible: boolean;
  onBack: () => void;
  onChallenge: (aiId: string) => void;
}

export default function LegacyAI({ session, visible, onBack, onChallenge }: LegacyAIProps) {
  const [myAi, setMyAi] = useState<PersonalAI | null>(null);
  const [winsRequired, setWinsRequired] = useState(5);
  const [myWins, setMyWins] = useState<number | null>(null);
  const [lobby, setLobby] = useState<LobbyEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authHeaders = { Authorization: `Bearer ${session.access_token}` };

  async function refresh() {
    const mineRes = await fetch(`${API_BASE}/personal-ai/mine`, { headers: authHeaders });
    const mineData = await mineRes.json();
    setMyAi(mineData.ai);
    setWinsRequired(mineData.wins_required);
    setMyWins(mineData.wins);

    const lobbyRes = await fetch(`${API_BASE}/personal-ai/lobby`, { headers: authHeaders });
    const lobbyData = await lobbyRes.json();
    setLobby(lobbyData.ais);
  }

  useEffect(() => {
    if (visible) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`${API_BASE}/personal-ai/create`, { method: "POST", headers: authHeaders });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.detail ?? "Couldn't create your AI.");
      return;
    }
    refresh();
  }

  async function handleRetrain() {
    setBusy(true);
    setError(null);
    const res = await fetch(`${API_BASE}/personal-ai/retrain`, { method: "POST", headers: authHeaders });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.detail ?? "Couldn't retrain your AI.");
      return;
    }
    setMyAi(data);
  }

  return (
    <div className="min-h-screen bg-ink text-parchment font-sans">
      <header className="flex items-center justify-between border-b border-brass/20 px-8 py-5">
        <h1 className="font-display text-2xl tracking-tight">Legacy AI</h1>
        <button type="button" onClick={onBack} className="text-sm text-brass/70 underline">
          &larr; Back to game
        </button>
      </header>

      <main className="mx-auto max-w-2xl space-y-12 px-8 py-12">
        <section>
          <h2 className="font-display text-lg text-verdigris">Your AI</h2>
          {myAi ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>Strength: {myAi.strength_rating}</p>
              <p>Bank: {myAi.bank} coins</p>
              <p className="text-parchment/60">
                Last retrained: {new Date(myAi.retrained_at).toLocaleDateString()}
              </p>
              <button
                type="button"
                onClick={handleRetrain}
                disabled={busy}
                className="mt-3 bg-verdigris px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
              >
                Retrain from your current rating
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-parchment/70">
                {myWins !== null
                  ? `${myWins} / ${winsRequired} wins toward creating your own AI.`
                  : "Loading\u2026"}
              </p>
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy || (myWins !== null && myWins < winsRequired)}
                className="bg-verdigris px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
              >
                Create your AI
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-signal">{error}</p>}
        </section>

        <section>
          <h2 className="font-display text-lg text-verdigris">Lobby</h2>
          {lobby.length === 0 ? (
            <p className="mt-3 text-sm text-parchment/50">No other players' AIs yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {lobby.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between border-b border-brass/10 pb-2">
                  <span>{entry.profiles?.username ?? "Unknown"}'s AI</span>
                  <span className="flex items-center gap-4">
                    <span className="text-parchment/70">
                      {entry.strength_rating} rated &middot; {entry.bank} coins
                    </span>
                    <button
                      type="button"
                      onClick={() => onChallenge(entry.id)}
                      className="bg-brass px-3 py-1 text-xs font-medium text-ink"
                    >
                      Challenge
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
