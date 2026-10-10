import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth";
import Game from "./components/Game";
import LegacyAI from "./components/LegacyAI";
import ChallengeGame from "./components/ChallengeGame";
import type { Profile } from "./lib/types";

type View = "play" | "legacy" | "challenge";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("play");
  const [challengeAiId, setChallengeAiId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const viewRef = useRef<View>("play");

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event: string, newSession: Session | null) => {
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
      .then(({ data }: { data: Profile | null }) => {
        if (data) setProfile(data);
      });
  }, [session]);

  // Android hardware/gesture Back: step back through our own screens instead
  // of closing the whole app, and minimise (not quit) from the main screen so
  // an in-progress game isn't torn down.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handle = CapacitorApp.addListener("backButton", () => {
      if (viewRef.current === "challenge") {
        setView("legacy");
      } else if (viewRef.current === "legacy") {
        setView("play");
      } else {
        CapacitorApp.minimizeApp();
      }
    });

    return () => {
      handle.then((h) => h.remove());
    };
  }, []);

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
