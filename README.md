# Cleopatra

**Live demo:** https://cleopatra-mocha.vercel.app

A chess platform built around one flagship AI opponent — human-elite strength (~2800), not engine-crushing — with a real personality instead of a difficulty slider.

## What makes Cleopatra different

**The Council.** Rather than a single engine evaluation, every move Cleopatra considers is scored by three advisor models inspired by Tal, Fischer, and Botvinnik, each weighting different features of a position (sacrifices, initiative, technique, prophylaxis). The move with the best combined score wins the vote — genuine three-way disagreement, not an injected "mistake."

**Match Report.** Every finished game gets a full post-game breakdown: an evaluation graph across the whole game, per-move classification (Brilliant / Best / Good / Inaccuracy / Mistake / Blunder) using the same win-probability math Lichess publishes, accuracy percentages, and 2–3 flagged turning points.

**Coach mode.** Those turning points are narrated by an LLM in a direct, teaching voice — explaining *why* a move was a mistake and what the engine recommended instead, not just that it was one.

**Legacy AI.** Once you've earned enough wins, your own playing style becomes an AI other players can challenge — coins staked, a 24-hour cooldown, a rating-band matchmaking gate, and your own league rank keeps moving a little even while you're offline, for better or worse.

**A real league ladder.** Eight tiers with three sub-ranks each (Tempo → Gambit → Fianchetto → Initiative → Zugzwang → Endgame → Grandmaster → Immortal), driven by an actual Elo rating system, not a cosmetic reskin.

## Stack

- **Backend:** Python, FastAPI, python-chess, Stockfish (via UCI, strength-capped with `UCI_LimitStrength`/`UCI_Elo`)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS v4 — hand-built board rendering, no off-the-shelf chess UI library
- **Auth & database:** Supabase (Postgres + Auth, JWKS-verified on the backend)
- **AI narration:** Groq (Llama 3.3 70B)
- **PWA:** installable on desktop and mobile, offline-ready app shell

## Status

Actively in development, running locally. Deployment to a public URL and native Android packaging (via Capacitor) are the next milestones.

