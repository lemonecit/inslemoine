import type { Analysis } from "./schema";

export type PughResult = {
  name: string;
  // Summa av vikt × betyg (+1 bättre, 0 lika, −1 sämre jämfört med referensprodukten).
  weighted: number;
  better: number;
  same: number;
  worse: number;
};

// Totalerna räknas alltid ut här och aldrig av AI-modellen, som kan räkna fel.
export function pughTotals(pugh: Analysis["pugh"]): PughResult[] {
  return pugh.options.map((option) => {
    let weighted = 0;
    let better = 0;
    let same = 0;
    let worse = 0;
    option.scores.forEach((score, i) => {
      weighted += score * (pugh.criteria[i]?.weight ?? 0);
      if (score > 0) better++;
      else if (score < 0) worse++;
      else same++;
    });
    return { name: option.name, weighted, better, same, worse };
  });
}

// 5 = mycket enkel att bygga, 1 = mycket svår (svårighetsgrad 1–5 vänds).
export function buildabilityFromDifficulty(difficulty: number): number {
  return Math.min(5, Math.max(1, 6 - difficulty));
}
