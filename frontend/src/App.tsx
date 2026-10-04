import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Game from "./components/Game";
import LegacyAI from "./components/LegacyAI";
import ChallengeGame from "./components/ChallengeGame";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"play" | "legacy" | "challenge">("play");
  const [challengeAiId, setChallengeAiId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-ink" />;
  }

  if (!session) {
    return <Auth />;
  }

  if (view === "legacy") {
    return (
      <LegacyAI
        session={session}
        onBack={() => setView("play")}
        onChallenge={(aiId) => {
          setChallengeAiId(aiId);
          setView("challenge");
        }}
      />
    );
  }

  if (view === "challenge" && challengeAiId) {
    return <ChallengeGame session={session} aiId={challengeAiId} onBack={() => setView("legacy")} />;
  }

  return <Game session={session} onNavigateLegacy={() => setView("legacy")} />;
}
