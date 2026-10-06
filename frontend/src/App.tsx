import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Game from "./components/Game";
import LegacyAI from "./components/LegacyAI";
import ChallengeGame from "./components/ChallengeGame";
import type { Profile } from "./lib/types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"play" | "legacy" | "challenge">("play");
  const [challengeAiId, setChallengeAiId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("username, rating, coins, legacy_points, badge_ai_slayer")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  }, [session]);

  function handleProfileChange(updates: Partial<Profile>) {
    setProfile((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          (next as Record<string, unknown>)[key] = value;
        }
      }
      return next;
    });
  }

  if (loading) {
    return <div className="min-h-screen bg-ink" />;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      <div style={{ display: view === "play" ? "block" : "none" }}>
        <Game
          session={session}
          profile={profile}
          onProfileChange={handleProfileChange}
          onNavigateLegacy={() => setView("legacy")}
        />
      </div>
      <div style={{ display: view === "legacy" ? "block" : "none" }}>
        <LegacyAI
          session={session}
          visible={view === "legacy"}
          onBack={() => setView("play")}
          onChallenge={(aiId) => {
            setChallengeAiId(aiId);
            setView("challenge");
          }}
        />
      </div>
      {challengeAiId && (
        <div style={{ display: view === "challenge" ? "block" : "none" }}>
          <ChallengeGame
            key={challengeAiId}
            session={session}
            aiId={challengeAiId}
            onProfileChange={handleProfileChange}
            onBack={() => setView("legacy")}
          />
        </div>
      )}
    </>
  );
}

