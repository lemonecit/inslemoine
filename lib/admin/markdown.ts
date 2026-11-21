import { APPROACH_LABELS, STATUS_LABELS, type Idea } from "./schema";
import { isoClassTitle } from "./iso9999";
import { pughTotals } from "./scoring";

const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- (inga)");

// Underlag för bidragsansökningar. Allt som kommer från AI-modellen är uppskattningar.
export function ideaToMarkdown(idea: Idea): string {
  const a = idea.analysis;
  const totals = pughTotals(a.pugh);
  const pughHeader = `| Kriterium | Vikt | ${a.pugh.options.map((o) => o.name).join(" | ")} |`;
  const pughRule = `|---|---|${a.pugh.options.map(() => "---").join("|")}|`;
  const pughRows = a.pugh.criteria.map(
    (c, i) =>
      `| ${c.name} | ${c.weight} | ${a.pugh.options.map((o) => (o.scores[i] > 0 ? "+1" : o.scores[i] < 0 ? "−1" : "0")).join(" | ")} |`,
  );
  const pughTotal = `| **Viktad summa** | | ${totals.map((t) => `**${t.weighted > 0 ? "+" : ""}${t.weighted}**`).join(" | ")} |`;

  return [
    `# ${idea.title}`,
    "",
    `> Underlag genererat med AI (${idea.model}) och granskat av föreningen. Siffror och bedömningar är uppskattningar som ska verifieras innan de används externt.`,
    "",
    `- **Status:** ${STATUS_LABELS[idea.status]}${idea.next_sprint ? " (markerad för nästa sprint)" : ""}`,
    `- **Lösningstyp:** ${APPROACH_LABELS[a.proposal.approach]}`,
    `- **ISO 9999-klass:** ${idea.iso_class ? `${idea.iso_class} ${isoClassTitle(idea.iso_class)}` : "ej angiven"}`,
    `- **Analyserade produkter:** ${idea.products.map((p) => p.name).join(", ") || "–"}`,
    `- **Bidragspotential:** ${idea.grant_fit}/5 · **Enkel att bygga:** ${idea.buildability}/5`,
    "",
    "## Flaskhalsar i dagens lösningar",
    list(a.bottlenecks),
    "",
    "## Förslag på prototyp",
    `**${a.proposal.title}**`,
    "",
    a.proposal.summary,
    "",
    a.proposal.description,
    "",
    "### Nyckelfunktioner",
    list(a.proposal.key_features),
    "",
    "### Tillgänglighet",
    a.proposal.accessibility_notes,
    "",
    "## Teknisk genomförbarhet och kostnad",
    `- **Svårighetsgrad (1–5):** ${a.feasibility.difficulty}`,
    `- **Utvecklingsinsats:** ${a.feasibility.effort_estimate}`,
    `- **Utvecklingskostnad:** ${a.feasibility.build_cost_estimate}`,
    `- **Kostnad per enhet / drift:** ${a.feasibility.unit_cost_estimate}`,
    `- **Jämfört med marknadspris:** ${a.feasibility.market_price_comparison}`,
    "",
    "**Antaganden**",
    list(a.feasibility.assumptions),
    "",
    "**Risker**",
    list(a.feasibility.risks),
    "",
    "## Samhällsnytta och bidragspotential",
    `- **Målgrupp:** ${a.impact.beneficiaries}`,
    `- **Passform för bidrag (1–5):** ${a.impact.grant_fit} – ${a.impact.grant_fit_rationale}`,
    `- **Öppen källkod / freemium:** ${a.impact.open_source_potential}`,
    `- **Skalbarhet:** ${a.impact.scalability}`,
    "",
    "**Möjliga finansieringsspår (verifiera villkor och datum)**",
    list(a.impact.funding_tracks),
    "",
    "## SWOT",
    "**Styrkor**",
    list(a.swot.strengths),
    "",
    "**Svagheter**",
    list(a.swot.weaknesses),
    "",
    "**Möjligheter**",
    list(a.swot.opportunities),
    "",
    "**Hot**",
    list(a.swot.threats),
    "",
    `## Pugh-matris (referens: ${a.pugh.baseline})`,
    "+1 = bättre än referensen, 0 = likvärdig, −1 = sämre.",
    "",
    pughHeader,
    pughRule,
    ...pughRows,
    pughTotal,
    "",
    "## Egna anteckningar",
    idea.notes.trim() || "(inga)",
    "",
  ].join("\n");
}
