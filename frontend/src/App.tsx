import Board from "./components/Board";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const COUNCIL = ["Tal", "Fischer", "Botvinnik"];

export default function App() {
  return (
    <div className="min-h-screen bg-ink text-parchment font-sans">
      <header className="flex items-center justify-between border-b border-brass/20 px-8 py-5">
        <h1 className="font-display text-2xl tracking-tight">Cleopatra</h1>
        <span className="text-sm text-brass/80">Tempo &middot; 812</span>
      </header>

      <main className="flex flex-wrap items-start justify-center gap-12 px-8 py-12">
        <Board fen={STARTING_FEN} />

        <aside className="w-64 space-y-10">
          <section>
            <h2 className="font-display text-lg text-verdigris">Council</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {COUNCIL.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between border-b border-brass/10 pb-2"
                >
                  <span>{name}</span>
                  <span className="text-brass/50">quiet</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg text-verdigris">Moves</h2>
            <p className="mt-3 text-sm text-parchment/50">No moves yet.</p>
          </section>
        </aside>
      </main>
    </div>
  );
}
