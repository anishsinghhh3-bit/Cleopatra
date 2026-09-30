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
  selectedSquare?: string | null;
  lastMove?: { from: string; to: string } | null;
  onSquareClick?: (square: string) => void;
}

export default function Board({ fen, selectedSquare, lastMove, onSquareClick }: BoardProps) {
  const grid = parseFen(fen);

  return (
    <div className="inline-grid grid-cols-8 border-2 border-brass/60 shadow-lg">
      {grid.map((rank, rankIndex) =>
        rank.map((square, fileIndex) => {
          const isLight = (rankIndex + fileIndex) % 2 === 0;
          const rankLabel = 8 - rankIndex;
          const fileLabel = FILES[fileIndex];
          const squareName = `${fileLabel}${rankLabel}`;
          const isSelected = selectedSquare === squareName;
          const isLastMove = !!lastMove && (lastMove.from === squareName || lastMove.to === squareName);

          return (
            <button
              key={squareName}
              type="button"
              onClick={() => onSquareClick && onSquareClick(squareName)}
              className={`relative flex h-16 w-16 appearance-none items-center justify-center border-0 p-0 ${
                isLight ? "bg-parchment" : "bg-surface"
              }`}
            >
              {isLastMove && (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundColor: "rgba(176, 141, 87, 0.4)" }}
                />
              )}
              {isSelected && (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{ boxShadow: "inset 0 0 0 4px #7FA592" }}
                />
              )}

              {square && (
                <span
                  className="relative select-none text-5xl leading-none"
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
                <span className="absolute left-1 top-0.5 font-sans text-xs font-medium text-brass">
                  {rankLabel}
                </span>
              )}
              {rankIndex === 7 && (
                <span className="absolute bottom-0.5 right-1 font-sans text-xs font-medium text-brass">
                  {fileLabel}
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
