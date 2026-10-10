import type { CSSProperties } from "react";
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

// Square size shrinks on narrow screens so the whole board always fits
// (phones are roughly 360-430px wide) and caps at 4rem (64px) on larger ones.
const BOARD_VARS = { "--sq": "min(calc((100vw - 2.5rem) / 8), 4rem)" } as CSSProperties;

interface BoardProps {
  fen: string;
  selectedSquare?: string | null;
  lastMove?: { from: string; to: string } | null;
  onSquareClick?: (square: string) => void;
  disabled?: boolean;
}

export default function Board({ fen, selectedSquare, lastMove, onSquareClick, disabled }: BoardProps) {
  const grid = parseFen(fen);

  return (
    <div
      style={BOARD_VARS}
      className={`inline-grid grid-cols-8 border-2 border-brass/60 shadow-lg transition-opacity ${
        disabled ? "pointer-events-none opacity-70" : ""
      }`}
    >
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
              style={{ width: "var(--sq)", height: "var(--sq)" }}
              className={`relative flex appearance-none items-center justify-center border-0 p-0 ${
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
                  className="relative select-none leading-none"
                  style={{
                    fontSize: "calc(var(--sq) * 0.75)",
                    color: square.color === "white" ? "#E8E2D3" : "#12181A",
                    WebkitTextStroke:
                      square.color === "white" ? "1.5px #12181A" : "1.5px #E8E2D3",
                  }}
                >
                  {PIECE_GLYPHS[square.type]}
                </span>
              )}

              {fileIndex === 0 && (
                <span className="absolute left-1 top-0.5 font-sans text-[10px] font-medium text-brass sm:text-xs">
                  {rankLabel}
                </span>
              )}
              {rankIndex === 7 && (
                <span className="absolute bottom-0.5 right-1 font-sans text-[10px] font-medium text-brass sm:text-xs">
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
