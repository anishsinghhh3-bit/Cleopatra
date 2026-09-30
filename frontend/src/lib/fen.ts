export type PieceColor = "white" | "black";

export interface PlacedPiece {
  type: string;
  color: PieceColor;
}

export type BoardGrid = (PlacedPiece | null)[][];

export function parseFen(fen: string): BoardGrid {
  const placement = fen.split(" ")[0];
  const rows = placement.split("/");
  const grid: BoardGrid = [];

  for (const row of rows) {
    const rankSquares: (PlacedPiece | null)[] = [];
    for (const char of row) {
      if (/\d/.test(char)) {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount; i++) {
          rankSquares.push(null);
        }
      } else {
        const color: PieceColor = char === char.toUpperCase() ? "white" : "black";
        rankSquares.push({ type: char.toLowerCase(), color });
      }
    }
    grid.push(rankSquares);
  }

  return grid;
}

export function getPieceAt(grid: BoardGrid, square: string): PlacedPiece | null {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = parseInt(square[1], 10);
  const rankIndex = 8 - rank;
  return grid[rankIndex]?.[file] ?? null;
}
