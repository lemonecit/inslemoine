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

export type CostSummary = {
  // Summa av antal × styckpris. null om materiallistan är tom (då finns inget att räkna på).
  unit_cost_eur: number | null;
  market_price_eur: number | null;
  // Besparing mot marknadspriset i procent (negativ = dyrare än marknaden).
  saving_pct: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Besparing mot marknadspriset i procent (negativ = dyrare). null om något saknas.
export function savingPercent(unit: number | null, market: number | null): number | null {
  return unit !== null && market !== null && market > 0 ? Math.round((1 - unit / market) * 100) : null;
}

export function bomTotal(bom: Analysis["bom"]): number | null {
  if (bom.length === 0) return null;
  return round2(bom.reduce((sum, row) => sum + row.quantity * row.unit_cost_eur, 0));
}

export function costSummary(analysis: Analysis): CostSummary {
  const unit = bomTotal(analysis.bom);
  const market = analysis.feasibility.market_price_eur;
  return { unit_cost_eur: unit, market_price_eur: market, saving_pct: savingPercent(unit, market) };
}
