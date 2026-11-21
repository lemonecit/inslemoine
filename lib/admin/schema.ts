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

const Text = z.string().trim().min(1).max(1500);
const TextList = (min: number, max: number) => z.array(Text).min(min).max(max);
const Rating = z.coerce.number().int().min(1).max(5);
const Approach = z.enum(["software", "3d_print", "hybrid"]);

// En rad i materiallistan (hårdvara, material, licens eller drift). Summor räknas av koden.
export const BomItemSchema = z.object({
  item: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().min(0).max(100_000),
  unit_cost_eur: z.coerce.number().min(0).max(10_000_000),
  note: z.string().trim().max(400).default(""),
  cheaper_alternative: z.string().trim().max(400).default(""),
});
export type BomItem = z.output<typeof BomItemSchema>;

export const AnalysisSchema = z
  .object({
    bottlenecks: TextList(1, 8),
    proposal: z.object({
      title: z.string().trim().min(1).max(160),
      approach: Approach,
      summary: Text,
      description: z.string().trim().min(1).max(4000),
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
      market_price_eur: z.coerce.number().min(0).max(10_000_000).nullable().default(null),
      assumptions: z.array(Text).max(8),
      risks: z.array(Text).max(8),
    }),
    // Äldre idéer saknar materiallista : tom lista är giltig.
    bom: z.array(BomItemSchema).max(40).default([]),
    impact: z.object({
      beneficiaries: Text,
      grant_fit: Rating,
      grant_fit_rationale: Text,
      funding_tracks: z.array(Text).max(6),
      open_source_potential: Text,
      scalability: Text,
    }),
    swot: z.object({
      strengths: TextList(1, 6),
      weaknesses: TextList(1, 6),
      opportunities: TextList(1, 6),
      threats: TextList(1, 6),
    }),
    pugh: z.object({
      baseline: z.string().trim().min(1).max(200),
      criteria: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(120),
            weight: z.coerce.number().int().min(1).max(5),
          }),
        )
        .min(3)
        .max(10),
      options: z
        .array(
          z.object({
            name: z.string().trim().min(1).max(200),
            scores: z.array(z.coerce.number().int().min(-1).max(1)),
          }),
        )
        .min(1)
        .max(4),
    }),
  })
  .superRefine((analysis, ctx) => {
    const n = analysis.pugh.criteria.length;
    analysis.pugh.options.forEach((option, i) => {
      if (option.scores.length !== n) {
        ctx.addIssue({
          code: "custom",
          path: ["pugh", "options", i, "scores"],
          message: `Pugh-poängen måste vara ${n} stycken (ett per kriterium)`,
        });
      }
    });
  });
export type Analysis = z.output<typeof AnalysisSchema>;

// Ett koncept är en kort idé från brainstormen, innan den utvecklats till en full analys.
export const ConceptSchema = z.object({
  title: z.string().trim().min(1).max(160),
  approach: Approach,
  summary: Text,
  target_group: Text,
  how_cheaper: Text,
  unit_cost_eur: z.coerce.number().min(0).max(10_000_000).nullable().default(null),
  market_price_eur: z.coerce.number().min(0).max(10_000_000).nullable().default(null),
  difficulty: Rating,
});
export type Concept = z.output<typeof ConceptSchema>;

export const BrainstormResponseSchema = z.object({
  concepts: z.array(ConceptSchema).min(1).max(10),
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
  summary: Text,
  changes: z
    .array(z.object({ change: Text, effect: Text }))
    .min(1)
    .max(12),
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
