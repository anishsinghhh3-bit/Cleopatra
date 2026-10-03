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
  for (const [name, low, high] of LEAGUE_TIERS) {
    if (high !== null && rating > high) continue;
    if (rating < low) continue;
    if (name === "Immortal") {
      return { tier: name, subRank: null };
    }
    const span = (high as number) - low + 1;
    const third = span / 3;
    const position = rating - low;
    const subRank = position < third ? 1 : position < 2 * third ? 2 : 3;
    return { tier: name, subRank };
  }
  return { tier: "Immortal", subRank: null };
}

export function formatLeague(league: League): string {
  return league.subRank ? `${league.tier} ${league.subRank}` : league.tier;
}
