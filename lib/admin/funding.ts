import { z } from "zod";
import { List, MoneyOrNull, OptText, Rating, ShortText, clip, nullToEmpty } from "./schema";

export const CALL_STATUSES = ["new", "interested", "preparing", "submitted", "granted", "rejected", "dropped"] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  new: "Ny",
  interested: "Intressant",
  preparing: "Förbereds",
  submitted: "Inskickad",
  granted: "Beviljad",
  rejected: "Avslagen",
  dropped: "Avförd",
};

export const FUNDER_KINDS = ["foundation", "eu", "state", "company", "other"] as const;
export type FunderKind = (typeof FUNDER_KINDS)[number];

export const FUNDER_KIND_LABELS: Record<FunderKind, string> = {
  foundation: "Stiftelse",
  eu: "EU",
  state: "Stat eller myndighet",
  company: "Företag",
  other: "Annat",
};

export const DRAFT_LANGUAGES = ["fr", "sv", "en"] as const;
export const DRAFT_LANGUAGE_LABELS = { fr: "Franska", sv: "Svenska", en: "Engelska" } as const;

// Godtar ÅÅÅÅ-MM-DD, DD/MM/ÅÅÅÅ och DD.MM.ÅÅÅÅ. Ger null om datumet inte finns i kalendern.
export function parseDateLoose(value: string): string | null {
  const s = value.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Hela dagar mellan idag och ett datum (negativt = passerat). Räknas i UTC så att sommartid inte spelar roll.
export function daysUntil(dateIso: string, today: Date): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
}

const DateOrNull = z.preprocess((v) => (typeof v === "string" ? parseDateLoose(v) : null), z.string().nullable());
const oneOf = <T extends readonly string[]>(values: T, fallback: T[number]) =>
  z.preprocess((v) => (typeof v === "string" && (values as readonly string[]).includes(v) ? v : fallback), z.enum(values as unknown as [string, ...string[]]));

// Samma tåliga schema används för det AI:n plockar ut ur en utlysning och för det administratören sparar.
// Varje fält har ett värde även om det saknas, så en halvfärdig utlysning går att spara och fylla i senare.
export const CallInputSchema = z.object({
  title: ShortText(200),
  funder: OptText(200),
  kind: oneOf(FUNDER_KINDS, "other") as unknown as z.ZodType<FunderKind>,
  url: z.preprocess((v) => (typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim().slice(0, 500) : ""), z.string()),
  deadline: DateOrNull,
  amount_min_eur: MoneyOrNull,
  amount_max_eur: MoneyOrNull,
  eligibility: OptText(3000),
  requirements: List(ShortText(300), 0, 30),
  summary: OptText(3000),
  status: oneOf(CALL_STATUSES, "new") as unknown as z.ZodType<CallStatus>,
  next_step: OptText(300),
  next_step_date: DateOrNull,
  notes: OptText(5000),
});
export type CallInput = z.output<typeof CallInputSchema>;

export type CallMatch = {
  idea_id: string;
  idea_title: string;
  score: number;
  rationale: string;
  gaps: string[];
  created_at: string;
};

export type ChecklistItem = { id: string; label: string; done: boolean; due_date: string | null; position: number };

export type DraftMeta = {
  id: string;
  title: string;
  language: string;
  idea_id: string | null;
  updated_at: string;
};

export type Call = CallInput & {
  id: string;
  best_fit: number | null;
  created_at: string;
  updated_at: string;
};

export type CallDetail = Call & {
  matches: CallMatch[];
  checklist: ChecklistItem[];
  drafts: DraftMeta[];
};

export type Draft = DraftMeta & { call_id: string; content: string; model: string; created_at: string };

export const ExtractRequestSchema = z.object({
  text: z.string().trim().min(20, "Klistra in mer text från utlysningen").max(60_000),
  url: z.string().trim().max(500).default(""),
});

export const MatchRequestSchema = z.object({ idea_ids: z.array(z.string().min(1).max(64)).max(10).default([]) });

const MatchItem = z.object({
  idea_id: ShortText(64),
  score: Rating,
  rationale: OptText(1200),
  gaps: List(ShortText(300), 0, 6),
});

// En ogiltig rad (t.ex. utan idé-id) fäller inte de andra.
export const MatchResponseSchema = z.object({
  matches: z
    .preprocess((v) => (Array.isArray(v) ? v.filter((m) => MatchItem.safeParse(m).success) : []), z.array(MatchItem))
    .transform((rows) => rows.slice(0, 20)),
});

export const DraftRequestSchema = z.object({
  idea_id: z.string().min(1).max(64).optional(),
  language: z.enum(DRAFT_LANGUAGES).default("fr"),
  instructions: z.string().trim().max(1000).default(""),
});

export const DraftResponseSchema = z.object({
  title: ShortText(200),
  content: z.preprocess(nullToEmpty, z.string().trim().min(50, "Utkastet är för kort")).transform(clip(40_000)),
});

export const DraftPatchSchema = z
  .object({ title: z.string().trim().min(1).max(200), content: z.string().max(60_000) })
  .partial();

export const ChecklistCreateSchema = z.object({
  label: z.string().trim().min(1).max(300),
  due_date: z.preprocess((v) => (typeof v === "string" ? parseDateLoose(v) : null), z.string().nullable()).default(null),
});

export const ChecklistPatchSchema = z
  .object({
    label: z.string().trim().min(1).max(300),
    done: z.boolean(),
    due_date: z.preprocess((v) => (typeof v === "string" ? parseDateLoose(v) : null), z.string().nullable()),
  })
  .partial();

export const ProfilePutSchema = z.object({ profile: z.string().trim().min(10, "Profilen är för kort").max(6000) });

// Vanliga underlag som franska finansiärer ofta begär från en förening. Det är en påminnelse, inte ett
// krav : varje utlysning har sina egna regler, så listan ska alltid kontrolleras mot den.
export const STANDARD_DOCS = [
  "Statuts (stadgar)",
  "Récépissé de déclaration en préfecture och publikation i Journal officiel",
  "Numéro RNA och SIRET",
  "RIB (föreningens bankuppgifter)",
  "Styrelsens sammansättning (composition du bureau)",
  "Budget prévisionnel (projektbudget)",
  "Projektbeskrivning och tidsplan",
  "Senaste bokslut (om sådant finns)",
  "Rapport d'activité (verksamhetsberättelse, om sådan finns)",
  "Behörighet för den som undertecknar ansökan",
] as const;

// Sammanställer checklistan från utlysningens krav och standardlistan utan dubbletter.
export function buildChecklistLabels(requirements: string[], existing: string[], includeStandard: boolean): string[] {
  const seen = new Set(existing.map((l) => l.trim().toLowerCase()));
  const out: string[] = [];
  for (const label of [...requirements, ...(includeStandard ? STANDARD_DOCS : [])]) {
    const key = label.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label.trim());
  }
  return out;
}

type CalendarCall = { id: string; title: string; funder: string; deadline: string | null; next_step: string; next_step_date: string | null };

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDate = (iso: string) => iso.replace(/-/g, "");
const nextDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

// iCalendar-fil (heldagshändelser) med deadlines och nästa steg, att öppna i valfri kalenderapp.
export function buildIcs(calls: CalendarCall[], now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events: string[] = [];
  const add = (uid: string, date: string, summary: string, description: string) => {
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:${uid}@institut-lemoine.fr`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(date)}`,
        `DTEND;VALUE=DATE:${icsDate(nextDay(date))}`,
        `SUMMARY:${icsText(summary)}`,
        ...(description ? [`DESCRIPTION:${icsText(description)}`] : []),
        "END:VEVENT",
      ].join("\r\n"),
    );
  };
  for (const c of calls) {
    const who = c.funder ? `${c.title} (${c.funder})` : c.title;
    if (c.deadline) add(`call-${c.id}-deadline`, c.deadline, `Deadline: ${who}`, "Verifiera alltid datumet mot utlysningen.");
    if (c.next_step_date) add(`call-${c.id}-next`, c.next_step_date, `Nästa steg: ${c.next_step || "se utlysning"} – ${c.title}`, "");
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Institut Lemoine Accessibilite//Finansiering//SV", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR", ""].join("\r\n");
}
