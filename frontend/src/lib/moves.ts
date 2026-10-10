export interface MoveRound {
  human: string;
  reply: string | null;
}

/** Turn the server's flat move list ["e2e4","e7e5","g1f3"] into display rows. */
export function pairMoves(list: string[]): MoveRound[] {
  const rounds: MoveRound[] = [];
  for (let i = 0; i < list.length; i += 2) {
    rounds.push({ human: list[i], reply: list[i + 1] ?? null });
  }
  return rounds;
}

/** True when the server is still waiting on the opponent (Black) to move. */
export function awaitingOpponent(state: { turn?: string; game_over?: boolean }): boolean {
  return state.turn === "black" && !state.game_over;
}
