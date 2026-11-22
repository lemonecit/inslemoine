/* eslint-disable @typescript-eslint/no-explicit-any -- testerna ändrar fritt i JSON-liknande data för att likna slarviga AI-svar */
import assert from "node:assert/strict";
import { test } from "node:test";
import { importCsv, importJson, parseCsv, parsePrice } from "../lib/admin/import";
import { isoClassOf, normalizeIsoCode } from "../lib/admin/iso9999";
import { ideaToMarkdown } from "../lib/admin/markdown";
import {
  AnalysisSchema,
  AnalyzeRequestSchema,
  BrainstormResponseSchema,
  CheaperResponseSchema,
  ConceptSchema,
  type Analysis,
  type Idea,
} from "../lib/admin/schema";
import { bomTotal, buildabilityFromDifficulty, costSummary, pughTotals } from "../lib/admin/scoring";

test("ISO 9999-koder normaliseras och okända klasser nekas", () => {
  assert.equal(normalizeIsoCode("22 03 18"), "22 03 18");
  assert.equal(normalizeIsoCode("220318"), "22 03 18");
  assert.equal(normalizeIsoCode("22.03"), "22 03");
  assert.equal(normalizeIsoCode("22"), "22");
  assert.equal(normalizeIsoCode("99 01"), null);
  assert.equal(normalizeIsoCode("2203 1"), null);
  assert.equal(normalizeIsoCode("abc"), null);
  assert.equal(isoClassOf("24 06 03"), "24");
});

test("priser tolkas i svenskt, franskt och engelskt format", () => {
  assert.equal(parsePrice("1 200,50 €"), 1200.5);
  assert.equal(parsePrice("€1,200.50"), 1200.5);
  assert.equal(parsePrice("1.200,5"), 1200.5);
  assert.equal(parsePrice("350"), 350);
  assert.equal(parsePrice("gratis"), null);
  assert.equal(parsePrice(-5), null);
});

test("CSV med semikolon, citattecken och radbrytning i fält", () => {
  const rows = parseCsv('namn;pris\n"Läsplatta; stor";"1 200,00"\n"Rad med\nradbrytning";99\n');
  assert.deepEqual(rows, [
    ["namn", "pris"],
    ["Läsplatta; stor", "1 200,00"],
    ["Rad med\nradbrytning", "99"],
  ]);
});

test("CSV-import mappar svenska och franska kolumnnamn och varnar för ogiltiga rader", () => {
  const csv = [
    "Produktnamn;ISO;Tillverkare;Pris;Begränsningar;Länk",
    "Skärmläsare X;22 03 18;Firma AB;1 200 €;dyr | kräver licens;https://exempel.se/x",
    ";22;Tom;1;;",
    "Knappsats;99 99;;;;javascript:alert(1)",
  ].join("\n");
  const { rows, warnings } = importCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Skärmläsare X");
  assert.equal(rows[0].iso_code, "22 03 18");
  assert.equal(rows[0].price_min_eur, 1200);
  assert.equal(rows[0].price_max_eur, 1200);
  assert.deepEqual(rows[0].limitations, ["dyr", "kräver licens"]);
  assert.ok(warnings.some((w) => w.includes("Rad 2")));
  assert.ok(warnings.some((w) => w.includes("Rad 3")), "javascript:-länk ska avvisas");
});

test("JSON-import godtar lista eller { products }", () => {
  assert.equal(importJson('[{"name":"A"}]').rows.length, 1);
  assert.equal(importJson('{"products":[{"nom":"B","prix":10}]}').rows[0].price_min_eur, 10);
  assert.equal(importJson("inte json").rows.length, 0);
});

const analysis: Analysis = AnalysisSchema.parse({
  bottlenecks: ["Dyr hårdvara"],
  proposal: {
    title: "Webbaserad talsyntes",
    approach: "software",
    summary: "En PWA.",
    description: "Beskrivning.",
    key_features: ["Offline"],
    accessibility_notes: "WCAG AA.",
  },
  feasibility: {
    difficulty: "2",
    effort_estimate: "8 veckor",
    build_cost_estimate: "låg",
    unit_cost_estimate: "0 €",
    market_price_comparison: "1 200 € mot 0 €",
    market_price_eur: 1200,
    assumptions: [],
    risks: ["Röstkvalitet"],
  },
  bom: [
    { item: "Mikrokontroller", quantity: 2, unit_cost_eur: 4.5, note: "ESP32", cheaper_alternative: "Kassera onödig modul" },
    { item: "Hölje (3D-print)", quantity: 1, unit_cost_eur: 1.25 },
  ],
  impact: {
    beneficiaries: "Personer med talsvårigheter",
    grant_fit: 4,
    grant_fit_rationale: "Hög samhällsnytta",
    funding_tracks: ["Fondation Orange (verifiera)"],
    open_source_potential: "Hög",
    scalability: "God",
  },
  swot: { strengths: ["a"], weaknesses: ["b"], opportunities: ["c"], threats: ["d"] },
  pugh: {
    baseline: "Dyr enhet",
    criteria: [
      { name: "Kostnad", weight: 5 },
      { name: "Tillgänglighet", weight: 4 },
      { name: "Enkelhet", weight: 2 },
    ],
    options: [
      { name: "Prototyp", scores: [1, 1, -1] },
      { name: "Hybrid", scores: [0, 1, -1] },
    ],
  },
});

test("Pugh-summor räknas ut i koden och svårighetsgrad vänds", () => {
  const [a, b] = pughTotals(analysis.pugh);
  assert.equal(a.weighted, 5 + 4 - 2);
  assert.deepEqual([a.better, a.same, a.worse], [2, 0, 1]);
  assert.equal(b.weighted, 0 + 4 - 2);
  assert.equal(buildabilityFromDifficulty(analysis.feasibility.difficulty), 4);
  assert.equal(buildabilityFromDifficulty(5), 1);
});

test("Pugh-poängen som inte matchar kriterierna rättas i stället för att avvisa svaret", () => {
  const short = structuredClone(analysis);
  short.pugh.options[0].scores = [1];
  const fixed = AnalysisSchema.parse(short);
  assert.equal(fixed.pugh.options[0].scores.length, fixed.pugh.criteria.length);
  assert.deepEqual(fixed.pugh.options[0].scores, [1, 0, 0]);

  const long = structuredClone(analysis);
  long.pugh.options[0].scores = [1, 1, 1, 1, 1, 1];
  assert.equal(AnalysisSchema.parse(long).pugh.options[0].scores.length, 3);
});

test("slarvigt AI-svar rättas : null, siffror som text, för långa texter och listor, synonymer", () => {
  const sloppy = structuredClone(analysis) as Record<string, any>;
  sloppy.proposal.approach = "Hybrid (mjukvara + 3D-print)";
  sloppy.proposal.summary = "x".repeat(5000);
  sloppy.bottlenecks = Array.from({ length: 20 }, (_, i) => `Flaskhals ${i}`);
  sloppy.assumptions = null;
  sloppy.feasibility.difficulty = "7";
  sloppy.feasibility.market_price_eur = "ca 1 200 €";
  sloppy.feasibility.assumptions = null;
  sloppy.impact.grant_fit = 3.6;
  sloppy.swot.threats = [];
  sloppy.bom = [
    { item: "Bra rad", quantity: "2", unit_cost_eur: "4,5 €", note: null, cheaper_alternative: null },
    { item: "Rad utan pris", quantity: 1 },
    "skräp",
  ];
  sloppy.pugh.criteria[0].weight = 9;
  sloppy.pugh.options[0].scores = [2, "-3", null];
  const parsed = AnalysisSchema.parse(sloppy);
  assert.equal(parsed.proposal.approach, "hybrid");
  assert.equal(parsed.proposal.summary.length, 1500);
  assert.equal(parsed.bottlenecks.length, 8);
  assert.deepEqual(parsed.feasibility.assumptions, []);
  assert.equal(parsed.feasibility.difficulty, 5);
  assert.equal(parsed.feasibility.market_price_eur, 1200);
  assert.equal(parsed.impact.grant_fit, 4);
  assert.deepEqual(parsed.swot.threats, []);
  assert.equal(parsed.bom.length, 1);
  assert.equal(parsed.bom[0].unit_cost_eur, 4.5);
  assert.equal(parsed.bom[0].note, "");
  assert.equal(parsed.pugh.criteria[0].weight, 5);
  assert.deepEqual(parsed.pugh.options[0].scores, [1, -1, 0]);
});

test("det som verkligen saknas avvisas fortfarande", () => {
  const noTitle = structuredClone(analysis) as Record<string, any>;
  delete noTitle.proposal.title;
  assert.equal(AnalysisSchema.safeParse(noTitle).success, false);
  const noPugh = structuredClone(analysis) as Record<string, any>;
  noPugh.pugh.criteria = [];
  assert.equal(AnalysisSchema.safeParse(noPugh).success, false);
  assert.equal(AnalysisSchema.safeParse({}).success, false);
});

test("Markdown-exporten innehåller de viktiga avsnitten", () => {
  const idea: Idea = {
    id: "1",
    title: "Webbaserad talsyntes",
    status: "prioritized",
    approach: "software",
    iso_class: "22",
    grant_fit: 4,
    buildability: 4,
    next_sprint: true,
    notes: "Ring Fondation Orange.",
    analysis,
    model: "test-modell",
    version: 2,
    products: [{ id: "p", name: "Dyr enhet" }],
    created_at: "2026-11-21T00:00:00Z",
    updated_at: "2026-11-21T00:00:00Z",
  };
  const md = ideaToMarkdown(idea);
  for (const part of [
    "# Webbaserad talsyntes",
    "## SWOT",
    "## Pugh-matris",
    "**+7**",
    "Ring Fondation Orange.",
    "nästa sprint",
    "## Materiallista",
    "Mikrokontroller (ESP32)",
    "Uppskattad besparing: 99 %",
    "**Version:** 2",
  ]) {
    assert.ok(md.includes(part), `saknar: ${part}`);
  }
});

test("materialsumman och besparingen räknas i koden, inte av AI:n", () => {
  const cost = costSummary(analysis);
  assert.equal(cost.unit_cost_eur, 10.25);
  assert.equal(cost.market_price_eur, 1200);
  assert.equal(cost.saving_pct, 99);
  assert.equal(bomTotal([]), null);
  const noMarket = structuredClone(analysis);
  noMarket.feasibility.market_price_eur = null;
  assert.equal(costSummary(noMarket).saving_pct, null);
});

test("äldre analyser utan materiallista och marknadspris är fortfarande giltiga", () => {
  const old = structuredClone(analysis) as Record<string, unknown>;
  delete old.bom;
  delete (old.feasibility as Record<string, unknown>).market_price_eur;
  const parsed = AnalysisSchema.parse(old);
  assert.deepEqual(parsed.bom, []);
  assert.equal(parsed.feasibility.market_price_eur, null);
  assert.equal(costSummary(parsed).unit_cost_eur, null);
});

test("koncept och billigare-svar valideras", () => {
  const concept = ConceptSchema.parse({
    title: "Tangentbordsfri kommunikationsapp",
    approach: "software",
    summary: "En PWA.",
    target_group: "Personer utan tal",
    how_cheaper: "Använder befintlig smartphone.",
    unit_cost_eur: "0",
    difficulty: 2,
  });
  assert.equal(concept.unit_cost_eur, 0);
  assert.equal(concept.market_price_eur, null);
  assert.equal(BrainstormResponseSchema.safeParse({ concepts: [] }).success, false);
  // Ett ogiltigt koncept fäller inte de andra.
  const mixed = BrainstormResponseSchema.parse({ concepts: [concept, { title: "", approach: "?" }] });
  assert.equal(mixed.concepts.length, 1);
  const cheaper = CheaperResponseSchema.safeParse({ analysis, summary: "Billigare.", changes: [{ change: "Byt modul", effect: "−2 €" }] });
  assert.equal(cheaper.success, true);
  assert.equal(CheaperResponseSchema.safeParse({ analysis, summary: "x", changes: [{ change: "Utan effekt" }] }).success, true);
  assert.equal(AnalyzeRequestSchema.safeParse({}).success, false);
  assert.equal(AnalyzeRequestSchema.safeParse({ concept }).success, true);
});
