import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signIn") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (!data.session) {
      // No session came back -- this project still requires email confirmation.
      setCheckEmail(true);
    }
    // If a session DID come back (confirmation disabled), we do nothing here --
    // the auth-state listener in App.tsx picks it up and routes into the app.
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink font-sans text-parchment">
        <p className="font-display text-lg">Check your email to confirm your account.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink font-sans text-parchment">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <h1 className="font-display text-3xl">Cleopatra</h1>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-brass/40 bg-surface px-3 py-2 text-parchment outline-none focus:border-verdigris"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border border-brass/40 bg-surface px-3 py-2 text-parchment outline-none focus:border-verdigris"
        />
        {error && <p className="text-sm text-signal">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-verdigris py-2 font-medium text-ink disabled:opacity-50"
        >
          {mode === "signIn" ? "Log in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          className="w-full text-sm text-brass/70 underline"
        >
          {mode === "signIn" ? "Need an account? Sign up" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
