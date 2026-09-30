import { parseFen } from "../lib/fen";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const PIECE_GLYPHS: Record<string, string> = {
  k: "\u265A",
  q: "\u265B",
  r: "\u265C",
  b: "\u265D",
  n: "\u265E",
  p: "\u265F",
};

interface BoardProps {
  fen: string;
}

export default function Board({ fen }: BoardProps) {
  const grid = parseFen(fen);

  return (
    <div className="inline-grid grid-cols-8 border border-brass/40 shadow-lg">
      {grid.map((rank, rankIndex) =>
        rank.map((square, fileIndex) => {
          const isLight = (rankIndex + fileIndex) % 2 === 0;
          const rankLabel = 8 - rankIndex;
          const fileLabel = FILES[fileIndex];

          return (
            <div
              key={`${rankLabel}${fileLabel}`}
              className={`relative flex h-16 w-16 items-center justify-center ${
                isLight ? "bg-parchment" : "bg-surface"
              }`}
            >
              {square && (
                <span
                  className="select-none text-5xl leading-none"
                  style={{
                    color: square.color === "white" ? "#E8E2D3" : "#12181A",
                    WebkitTextStroke:
                      square.color === "white" ? "1.5px #12181A" : "1.5px #E8E2D3",
                  }}
                >
                  {PIECE_GLYPHS[square.type]}
                </span>
              )}

              {fileIndex === 0 && (
                <span className="absolute left-1 top-0.5 font-sans text-[10px] text-brass/70">
                  {rankLabel}
                </span>
              )}
              {rankIndex === 7 && (
                <span className="absolute bottom-0.5 right-1 font-sans text-[10px] text-brass/70">
                  {fileLabel}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
