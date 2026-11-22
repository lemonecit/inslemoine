import { DEFAULT_PROFILE } from "../lib/admin/profile";
import {
  CallInputSchema,
  type Call,
  type CallDetail,
  type CallInput,
  type CallMatch,
  type ChecklistItem,
  type Draft,
  type DraftMeta,
} from "../lib/admin/funding";

const now = () => new Date().toISOString();

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

type CallRow = Omit<CallInput, "requirements"> & {
  id: string;
  requirements: string;
  best_fit: number | null;
  source_text: string;
  created_at: string;
  updated_at: string;
};

function toCall(row: CallRow): Call {
  const requirements = Array.isArray(safeJson(row.requirements)) ? (safeJson(row.requirements) as unknown[]).map(String) : [];
  const { source_text: _source, ...rest } = row;
  void _source;
  return { ...rest, requirements };
}

const SORTS: Record<string, string> = {
  deadline: "(deadline IS NULL), deadline ASC, updated_at DESC",
  updated: "updated_at DESC",
  fit: "(best_fit IS NULL), best_fit DESC, deadline ASC",
};

const SELECT = `SELECT c.*, (SELECT MAX(score) FROM call_matches m WHERE m.call_id = c.id) AS best_fit FROM funding_calls c`;

export async function listCalls(
  db: D1Database,
  filter: { status?: string; kind?: string; sort?: string; open_only?: boolean },
): Promise<Call[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    where.push("c.status = ?");
    params.push(filter.status);
  }
  if (filter.kind) {
    where.push("c.kind = ?");
    params.push(filter.kind);
  }
  // « Pågående » döljer det som är avslutat.
  if (filter.open_only) where.push("c.status NOT IN ('granted', 'rejected', 'dropped')");
  const order = SORTS[filter.sort ?? "deadline"] ?? SORTS.deadline;
  const sql = `SELECT * FROM (${SELECT}) AS c ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT 500`;
  const { results } = await db.prepare(sql).bind(...params).all<CallRow>();
  return results.map(toCall);
}

export async function getCallRow(db: D1Database, id: string): Promise<(Call & { source_text: string }) | null> {
  const row = await db.prepare(`${SELECT} WHERE c.id = ?`).bind(id).first<CallRow>();
  return row ? { ...toCall(row), source_text: row.source_text } : null;
}

export async function getCallDetail(db: D1Database, id: string): Promise<CallDetail | null> {
  const call = await getCallRow(db, id);
  if (!call) return null;
  const { source_text: _source, ...base } = call;
  void _source;
  const [matches, checklist, drafts] = await Promise.all([listMatches(db, id), listChecklist(db, id), listDrafts(db, id)]);
  return { ...base, matches, checklist, drafts };
}

export async function insertCall(db: D1Database, input: CallInput, sourceText = ""): Promise<Call> {
  const id = crypto.randomUUID();
  const stamp = now();
  await db
    .prepare(
      `INSERT INTO funding_calls (id, title, funder, kind, url, deadline, amount_min_eur, amount_max_eur, eligibility,
         requirements, summary, status, next_step, next_step_date, notes, source_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.title,
      input.funder,
      input.kind,
      input.url,
      input.deadline,
      input.amount_min_eur,
      input.amount_max_eur,
      input.eligibility,
      JSON.stringify(input.requirements),
      input.summary,
      input.status,
      input.next_step,
      input.next_step_date,
      input.notes,
      sourceText.slice(0, 30_000),
      stamp,
      stamp,
    )
    .run();
  const call = await getCallRow(db, id);
  if (!call) throw new Error("Utlysningen kunde inte läsas efter att den sparats.");
  const { source_text: _source, ...rest } = call;
  void _source;
  return rest;
}

export async function updateCall(db: D1Database, id: string, input: CallInput): Promise<Call | null> {
  const result = await db
    .prepare(
      `UPDATE funding_calls SET title = ?, funder = ?, kind = ?, url = ?, deadline = ?, amount_min_eur = ?,
         amount_max_eur = ?, eligibility = ?, requirements = ?, summary = ?, status = ?, next_step = ?,
         next_step_date = ?, notes = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(
      input.title,
      input.funder,
      input.kind,
      input.url,
      input.deadline,
      input.amount_min_eur,
      input.amount_max_eur,
      input.eligibility,
      JSON.stringify(input.requirements),
      input.summary,
      input.status,
      input.next_step,
      input.next_step_date,
      input.notes,
      now(),
      id,
    )
    .run();
  if (!result.meta.changes) return null;
  const call = await getCallRow(db, id);
  if (!call) return null;
  const { source_text: _source, ...rest } = call;
  void _source;
  return rest;
}

export async function deleteCall(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM funding_calls WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

// Slår ihop befintliga värden med de inkomna (för PATCH från formuläret används hela schemat).
export function parseCallInput(data: unknown): CallInput | null {
  const parsed = CallInputSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function listMatches(db: D1Database, callId: string): Promise<CallMatch[]> {
  const { results } = await db
    .prepare(
      `SELECT m.idea_id, i.title AS idea_title, m.score, m.rationale, m.gaps, m.created_at
       FROM call_matches m JOIN prototype_ideas i ON i.id = m.idea_id
       WHERE m.call_id = ? ORDER BY m.score DESC, i.title`,
    )
    .bind(callId)
    .all<Omit<CallMatch, "gaps"> & { gaps: string }>();
  return results.map((r) => ({
    ...r,
    gaps: Array.isArray(safeJson(r.gaps)) ? (safeJson(r.gaps) as unknown[]).map(String) : [],
  }));
}

export async function upsertMatches(
  db: D1Database,
  callId: string,
  matches: { idea_id: string; score: number; rationale: string; gaps: string[] }[],
  model: string,
): Promise<void> {
  if (matches.length === 0) return;
  const stamp = now();
  await db.batch(
    matches.map((m) =>
      db
        .prepare(
          `INSERT INTO call_matches (call_id, idea_id, score, rationale, gaps, model, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (call_id, idea_id) DO UPDATE SET score = excluded.score, rationale = excluded.rationale,
             gaps = excluded.gaps, model = excluded.model, created_at = excluded.created_at`,
        )
        .bind(callId, m.idea_id, m.score, m.rationale, JSON.stringify(m.gaps), model, stamp),
    ),
  );
}

export async function listChecklist(db: D1Database, callId: string): Promise<ChecklistItem[]> {
  const { results } = await db
    .prepare("SELECT id, label, done, due_date, position FROM call_checklist WHERE call_id = ? ORDER BY position, created_at")
    .bind(callId)
    .all<Omit<ChecklistItem, "done"> & { done: number }>();
  return results.map((r) => ({ ...r, done: r.done === 1 }));
}

export async function addChecklistItems(
  db: D1Database,
  callId: string,
  items: { label: string; due_date?: string | null }[],
): Promise<void> {
  if (items.length === 0) return;
  const stamp = now();
  const base = (
    await db.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM call_checklist WHERE call_id = ?").bind(callId).first<{ p: number }>()
  )?.p ?? -1;
  await db.batch(
    items.map((item, i) =>
      db
        .prepare("INSERT INTO call_checklist (id, call_id, label, done, due_date, position, created_at) VALUES (?, ?, ?, 0, ?, ?, ?)")
        .bind(crypto.randomUUID(), callId, item.label, item.due_date ?? null, base + 1 + i, stamp),
    ),
  );
}

export async function patchChecklistItem(
  db: D1Database,
  callId: string,
  itemId: string,
  patch: { label?: string; done?: boolean; due_date?: string | null },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.label !== undefined) {
    sets.push("label = ?");
    params.push(patch.label);
  }
  if (patch.done !== undefined) {
    sets.push("done = ?");
    params.push(patch.done ? 1 : 0);
  }
  if (patch.due_date !== undefined) {
    sets.push("due_date = ?");
    params.push(patch.due_date);
  }
  if (sets.length === 0) return true;
  const result = await db
    .prepare(`UPDATE call_checklist SET ${sets.join(", ")} WHERE id = ? AND call_id = ?`)
    .bind(...params, itemId, callId)
    .run();
  return result.meta.changes > 0;
}

export async function deleteChecklistItem(db: D1Database, callId: string, itemId: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM call_checklist WHERE id = ? AND call_id = ?").bind(itemId, callId).run();
  return result.meta.changes > 0;
}

export async function listDrafts(db: D1Database, callId: string): Promise<DraftMeta[]> {
  const { results } = await db
    .prepare("SELECT id, title, language, idea_id, updated_at FROM call_drafts WHERE call_id = ? ORDER BY updated_at DESC")
    .bind(callId)
    .all<DraftMeta>();
  return results;
}

export async function getDraft(db: D1Database, id: string): Promise<Draft | null> {
  return db
    .prepare("SELECT id, call_id, idea_id, language, title, content, model, created_at, updated_at FROM call_drafts WHERE id = ?")
    .bind(id)
    .first<Draft>();
}

export async function insertDraft(
  db: D1Database,
  data: { call_id: string; idea_id: string | null; language: string; title: string; content: string; model: string },
): Promise<Draft> {
  const id = crypto.randomUUID();
  const stamp = now();
  await db
    .prepare(
      `INSERT INTO call_drafts (id, call_id, idea_id, language, title, content, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, data.call_id, data.idea_id, data.language, data.title, data.content, data.model, stamp, stamp)
    .run();
  const draft = await getDraft(db, id);
  if (!draft) throw new Error("Utkastet kunde inte läsas efter att det sparats.");
  return draft;
}

export async function patchDraft(db: D1Database, id: string, patch: { title?: string; content?: string }): Promise<Draft | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    params.push(patch.title);
  }
  if (patch.content !== undefined) {
    sets.push("content = ?");
    params.push(patch.content);
  }
  if (sets.length) {
    sets.push("updated_at = ?");
    params.push(now());
    const result = await db.prepare(`UPDATE call_drafts SET ${sets.join(", ")} WHERE id = ?`).bind(...params, id).run();
    if (!result.meta.changes) return null;
  }
  return getDraft(db, id);
}

export async function deleteDraft(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM call_drafts WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

export async function getProfile(db: D1Database): Promise<string> {
  const row = await db.prepare("SELECT value FROM admin_settings WHERE key = 'profile'").first<{ value: string }>();
  return row?.value ?? DEFAULT_PROFILE;
}

export async function setProfile(db: D1Database, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at) VALUES ('profile', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(value, now())
    .run();
}
