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

export const AnalysisSchema = z
  .object({
    bottlenecks: TextList(1, 8),
    proposal: z.object({
      title: z.string().trim().min(1).max(160),
      approach: z.enum(["software", "3d_print", "hybrid"]),
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
      assumptions: z.array(Text).max(8),
      risks: z.array(Text).max(8),
    }),
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

export const AnalyzeRequestSchema = z.object({
  product_ids: z.array(z.string().min(1).max(64)).max(8).default([]),
  iso_class: z.string().regex(/^\d{2}$/).optional(),
  focus: z.string().trim().max(600).default(""),
});

export const ImportParseSchema = z.object({
  format: z.enum(["csv", "json", "text"]),
  content: z.string().min(1).max(200_000),
});

export const BulkProductsSchema = z.object({
  products: z.array(ProductInputSchema).min(1).max(200),
});
