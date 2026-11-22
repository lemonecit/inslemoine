import { z } from "zod";

export const IDEA_STATUSES = ["draft", "prioritized", "in_development", "archived"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "Utkast",
  prioritized: "Prioriterad",
  in_development: "Under utveckling",
  archived: "Arkiverad",
};

export const APPROACH_LABELS = {
  software: "Mjukvara",
  "3d_print": "3D-printad mekanik",
  hybrid: "Hybrid (mjukvara + mekanik)",
} as const;

const optionalText = (max: number) => z.string().trim().max(max).default("");

const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), "Måste börja med http:// eller https://")
  .default("");

const price = z.number().min(0).max(10_000_000).nullable().default(null);

export const ProductInputSchema = z.object({
  name: z.string().trim().min(1, "Namn saknas").max(200),
  iso_code: optionalText(20),
  manufacturer: optionalText(200),
  price_min_eur: price,
  price_max_eur: price,
  price_note: optionalText(300),
  function: optionalText(2000),
  target_group: optionalText(500),
  limitations: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  source_url: httpUrl,
  notes: optionalText(2000),
});
export type ProductInput = z.output<typeof ProductInputSchema>;

export type Product = ProductInput & {
  id: string;
  iso_class: string | null;
  created_at: string;
  updated_at: string;
};

// AI-modeller är slarviga med formen : null i stället för tom text, siffror som text, för långa texter
// och listor, synonymer för lösningstyp. Schemat rättar sådant i stället för att avvisa hela svaret.
// Det som fortfarande avvisas är det som verkligen saknas (t.ex. ingen titel eller ingen lista alls).
export const clip = (max: number) => (s: string) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
export const nullToEmpty = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "number" ? String(v) : v);
const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || v.trim() === "") return Number.NaN;
  return Number(v.replace(/[^\d.,-]/g, "").replace(",", "."));
};

export const ShortText = (max: number) => z.preprocess(nullToEmpty, z.string().trim().min(1)).transform(clip(max));
export const OptText = (max: number) => z.preprocess(nullToEmpty, z.string().trim()).transform(clip(max));
const Text = ShortText(1500);

export const List = <T extends z.ZodType>(item: T, min: number, max: number) =>
  z
    .preprocess(
      (v) => (Array.isArray(v) ? v.filter((x) => x !== null && !(typeof x === "string" && x.trim() === "")) : v ?? []),
      z.array(item).min(min),
    )
    .transform((items) => items.slice(0, max));
const TextList = (min: number, max: number) => List(Text, min, max);

export const Rating = z
  .preprocess(toNumber, z.number())
  .transform((n) => Math.min(5, Math.max(1, Math.round(n))));
const Money = z.preprocess(toNumber, z.number().min(0)).transform((n) => Math.min(n, 10_000_000));
export const MoneyOrNull = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = toNumber(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 10_000_000) : null;
}, z.number().nullable());

const Approach = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.toLowerCase();
  if (s.includes("hybrid")) return "hybrid";
  if (s.includes("3d") || s.includes("print") || s.includes("mekan")) return "3d_print";
  if (s.includes("soft") || s.includes("mjuk") || s.includes("app") || s.includes("web")) return "software";
  return v;
}, z.enum(["software", "3d_print", "hybrid"]));

// En rad i materiallistan (hårdvara, material, licens eller drift). Summor räknas av koden.
export const BomItemSchema = z.object({
  item: ShortText(200),
  quantity: z.preprocess(toNumber, z.number().min(0)).transform((n) => Math.min(n, 100_000)),
  unit_cost_eur: Money,
  note: OptText(400),
  cheaper_alternative: OptText(400),
});
export type BomItem = z.output<typeof BomItemSchema>;

const Pugh = z.object({
  baseline: ShortText(200),
  criteria: List(
    z.object({
      name: ShortText(120),
      weight: z.preprocess(toNumber, z.number()).transform((n) => Math.min(5, Math.max(1, Math.round(n)))),
    }),
    2,
    10,
  ),
  options: List(
    z.object({
      name: ShortText(200),
      scores: z.preprocess(
        (v) => (Array.isArray(v) ? v.map(toNumber).map((n) => (Number.isFinite(n) ? n : 0)) : []),
        z.array(z.number()),
      ),
    }),
    1,
    4,
  ),
});

export const AnalysisSchema = z
  .object({
    bottlenecks: TextList(1, 8),
    proposal: z.object({
      title: ShortText(160),
      approach: Approach,
      summary: Text,
      description: ShortText(4000),
      key_features: TextList(1, 10),
      accessibility_notes: Text,
    }),
    feasibility: z.object({
      difficulty: Rating,
      effort_estimate: Text,
      build_cost_estimate: Text,
      unit_cost_estimate: Text,
      market_price_comparison: Text,
      // Marknadspris för jämförbara befintliga lösningar (grov uppskattning, EUR).
      market_price_eur: MoneyOrNull,
      assumptions: TextList(0, 8),
      risks: TextList(0, 8),
    }),
    // Äldre idéer saknar materiallista : tom lista är giltig. Ogiltiga rader hoppas över.
    bom: z
      .preprocess(
        (v) => (Array.isArray(v) ? v.filter((row) => BomItemSchema.safeParse(row).success) : []),
        z.array(BomItemSchema),
      )
      .transform((rows) => rows.slice(0, 40)),
    impact: z.object({
      beneficiaries: Text,
      grant_fit: Rating,
      grant_fit_rationale: Text,
      funding_tracks: TextList(0, 6),
      open_source_potential: Text,
      scalability: Text,
    }),
    swot: z.object({
      strengths: TextList(0, 6),
      weaknesses: TextList(0, 6),
      opportunities: TextList(0, 6),
      threats: TextList(0, 6),
    }),
    pugh: Pugh,
  })
  // Pugh-poängen ska vara en per kriterium : saknade poäng räknas som « likvärdig » (0) och överflödiga
  // tas bort, så att tabellen alltid går att visa. Poängen begränsas till −1, 0 och +1.
  .transform((analysis) => {
    const n = analysis.pugh.criteria.length;
    const options = analysis.pugh.options.map((option) => ({
      ...option,
      scores: Array.from({ length: n }, (_, i) => Math.sign(Math.round(option.scores[i] ?? 0))),
    }));
    return { ...analysis, pugh: { ...analysis.pugh, options } };
  });
export type Analysis = z.output<typeof AnalysisSchema>;

// Ett koncept är en kort idé från brainstormen, innan den utvecklats till en full analys.
export const ConceptSchema = z.object({
  title: ShortText(160),
  approach: Approach,
  summary: Text,
  target_group: OptText(1500),
  how_cheaper: OptText(1500),
  unit_cost_eur: MoneyOrNull,
  market_price_eur: MoneyOrNull,
  difficulty: Rating,
});
export type Concept = z.output<typeof ConceptSchema>;

export const BrainstormResponseSchema = z.object({
  // Ett ogiltigt koncept i listan ska inte fälla de andra.
  concepts: z
    .preprocess(
      (v) => (Array.isArray(v) ? v.filter((c) => ConceptSchema.safeParse(c).success) : v),
      z.array(ConceptSchema).min(1),
    )
    .transform((concepts) => concepts.slice(0, 10)),
});

export const BrainstormRequestSchema = z.object({
  need: z.string().trim().min(3, "Beskriv behovet").max(1000),
  iso_class: z.string().regex(/^\d{2}$/).optional(),
  count: z.number().int().min(3).max(8).default(5),
  max_unit_cost_eur: z.number().min(0).max(1_000_000).optional(),
});

export const CheaperRequestSchema = z.object({
  target_cost_eur: z.number().min(0).max(1_000_000).optional(),
  hint: z.string().trim().max(600).default(""),
});

export const CheaperResponseSchema = z.object({
  analysis: AnalysisSchema,
  summary: OptText(1500),
  changes: List(z.object({ change: Text, effect: OptText(1500) }), 0, 12),
});

export const RestoreRequestSchema = z.object({ version: z.number().int().min(1) });

export type VersionSource = "initial" | "cheaper" | "restore";

export type VersionInfo = {
  version: number;
  source: VersionSource;
  summary: string;
  changes: { change: string; effect: string }[];
  unit_cost_eur: number | null;
  market_price_eur: number | null;
  saving_pct: number | null;
  created_at: string;
};

export type Idea = {
  id: string;
  title: string;
  status: IdeaStatus;
  approach: Analysis["proposal"]["approach"];
  iso_class: string | null;
  grant_fit: number;
  buildability: number;
  next_sprint: boolean;
  notes: string;
  analysis: Analysis;
  model: string;
  version: number;
  products: { id: string; name: string }[];
  created_at: string;
  updated_at: string;
};

export const IdeaPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    status: z.enum(IDEA_STATUSES),
    notes: z.string().max(10_000),
    grant_fit: Rating,
    buildability: Rating,
    next_sprint: z.boolean(),
    analysis: AnalysisSchema,
  })
  .partial();

export const AnalyzeRequestSchema = z
  .object({
    product_ids: z.array(z.string().min(1).max(64)).max(8).default([]),
    iso_class: z.string().regex(/^\d{2}$/).optional(),
    focus: z.string().trim().max(600).default(""),
    // Utveckla ett koncept från brainstormen till en full analys (ingen startprodukt behövs).
    concept: ConceptSchema.optional(),
  })
  .refine((r) => r.product_ids.length > 0 || r.iso_class || r.concept, {
    message: "Välj en produkt, en ISO-klass eller ett koncept.",
  });

export const ImportParseSchema = z.object({
  format: z.enum(["csv", "json", "text"]),
  content: z.string().min(1).max(200_000),
});

export const BulkProductsSchema = z.object({
  products: z.array(ProductInputSchema).min(1).max(200),
});
