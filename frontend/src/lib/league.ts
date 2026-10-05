const LEAGUE_TIERS: [string, number, number | null][] = [
  ["Tempo", 0, 899],
  ["Gambit", 900, 1099],
  ["Fianchetto", 1100, 1299],
  ["Initiative", 1300, 1499],
  ["Zugzwang", 1500, 1699],
  ["Endgame", 1700, 1999],
  ["Grandmaster", 2000, 2399],
  ["Immortal", 2400, null],
];

export interface League {
  tier: string;
  subRank: number | null;
}

export function leagueForRating(rating: number): League {
  const clamped = Math.max(0, rating);
  for (const [name, low, high] of LEAGUE_TIERS) {
    if (high !== null && clamped > high) continue;
    if (clamped < low) continue;
    if (name === "Immortal") {
      return { tier: name, subRank: null };
    }
    const span = (high as number) - low + 1;
    const third = span / 3;
    const position = clamped - low;
    const subRank = position < third ? 1 : position < 2 * third ? 2 : 3;
    return { tier: name, subRank };
  }
  return { tier: "Tempo", subRank: 1 };
}

export function formatLeague(league: League): string {
  return league.subRank ? `${league.tier} ${league.subRank}` : league.tier;
}
