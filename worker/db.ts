import { isoClassOf, normalizeIsoCode } from "../lib/admin/iso9999";
import {
  AnalysisSchema,
  type Analysis,
  type Idea,
  type IdeaStatus,
  type Product,
  type ProductInput,
} from "../lib/admin/schema";
import { HttpError } from "./http";

const now = () => new Date().toISOString();

type ProductRow = Omit<Product, "limitations"> & { limitations: string };

function toProduct(row: ProductRow): Product {
  let limitations: string[] = [];
  try {
    const parsed = JSON.parse(row.limitations);
    if (Array.isArray(parsed)) limitations = parsed.map(String);
  } catch {
    // Behåll tom lista om fältet är skadat.
  }
  return { ...row, limitations };
}

function prepareProduct(input: ProductInput) {
  let isoCode = "";
  if (input.iso_code) {
    const normalized = normalizeIsoCode(input.iso_code);
    if (!normalized) throw new HttpError(400, `Ogiltig ISO 9999-kod: ${input.iso_code}`);
    isoCode = normalized;
  }
  return { isoCode, isoClass: isoCode ? isoClassOf(isoCode) : null };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listProducts(
  db: D1Database,
  filter: { q?: string; iso_class?: string; limit?: number },
): Promise<Product[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.iso_class) {
    where.push("iso_class = ?");
    params.push(filter.iso_class);
  }
  if (filter.q) {
    const like = `%${escapeLike(filter.q)}%`;
    where.push(
      "(name LIKE ? ESCAPE '\\' OR manufacturer LIKE ? ESCAPE '\\' OR function LIKE ? ESCAPE '\\' OR target_group LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like, like);
  }
  const sql = `SELECT * FROM existing_products ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC LIMIT ?`;
  params.push(Math.min(filter.limit ?? 500, 500));
  const { results } = await db.prepare(sql).bind(...params).all<ProductRow>();
  return results.map(toProduct);
}

export async function getProducts(db: D1Database, ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const marks = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT * FROM existing_products WHERE id IN (${marks})`)
    .bind(...ids)
    .all<ProductRow>();
  return results.map(toProduct);
}

export async function productsInClass(db: D1Database, isoClass: string, limit = 12): Promise<Product[]> {
  const { results } = await db
    .prepare("SELECT * FROM existing_products WHERE iso_class = ? ORDER BY updated_at DESC LIMIT ?")
    .bind(isoClass, limit)
    .all<ProductRow>();
  return results.map(toProduct);
}

export async function insertProducts(db: D1Database, inputs: ProductInput[]): Promise<Product[]> {
  const stamp = now();
  const prepared = inputs.map((input) => {
    const { isoCode, isoClass } = prepareProduct(input);
    const id = crypto.randomUUID();
    const statement = db
      .prepare(
        `INSERT INTO existing_products
          (id, name, iso_code, iso_class, manufacturer, price_min_eur, price_max_eur, price_note,
           function, target_group, limitations, source_url, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.name,
        isoCode,
        isoClass,
        input.manufacturer,
        input.price_min_eur,
        input.price_max_eur,
        input.price_note,
        input.function,
        input.target_group,
        JSON.stringify(input.limitations),
        input.source_url,
        input.notes,
        stamp,
        stamp,
      );
    return { id, statement };
  });
  await db.batch(prepared.map((p) => p.statement));
  return getProducts(
    db,
    prepared.map((p) => p.id),
  );
}

export async function updateProduct(db: D1Database, id: string, input: ProductInput): Promise<Product | null> {
  const { isoCode, isoClass } = prepareProduct(input);
  const result = await db
    .prepare(
      `UPDATE existing_products SET name = ?, iso_code = ?, iso_class = ?, manufacturer = ?,
         price_min_eur = ?, price_max_eur = ?, price_note = ?, function = ?, target_group = ?,
         limitations = ?, source_url = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.name,
      isoCode,
      isoClass,
      input.manufacturer,
      input.price_min_eur,
      input.price_max_eur,
      input.price_note,
      input.function,
      input.target_group,
      JSON.stringify(input.limitations),
      input.source_url,
      input.notes,
      now(),
      id,
    )
    .run();
  if (!result.meta.changes) return null;
  return (await getProducts(db, [id]))[0] ?? null;
}

export async function deleteProduct(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM existing_products WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

type IdeaRow = {
  id: string;
  title: string;
  status: IdeaStatus;
  approach: Idea["approach"];
  iso_class: string | null;
  grant_fit: number;
  buildability: number;
  next_sprint: number;
  notes: string;
  analysis: string;
  model: string;
  created_at: string;
  updated_at: string;
};

async function hydrateIdeas(db: D1Database, rows: IdeaRow[]): Promise<Idea[]> {
  if (rows.length === 0) return [];
  const marks = rows.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT ip.idea_id AS idea_id, p.id AS id, p.name AS name
       FROM idea_products ip JOIN existing_products p ON p.id = ip.product_id
       WHERE ip.idea_id IN (${marks}) ORDER BY p.name`,
    )
    .bind(...rows.map((r) => r.id))
    .all<{ idea_id: string; id: string; name: string }>();

  return rows.flatMap((row) => {
    const parsed = AnalysisSchema.safeParse(safeJson(row.analysis));
    // En skadad analys ska inte stoppa hela listan.
    if (!parsed.success) return [];
    return [
      {
        id: row.id,
        title: row.title,
        status: row.status,
        approach: row.approach,
        iso_class: row.iso_class,
        grant_fit: row.grant_fit,
        buildability: row.buildability,
        next_sprint: row.next_sprint === 1,
        notes: row.notes,
        analysis: parsed.data,
        model: row.model,
        products: results.filter((p) => p.idea_id === row.id).map((p) => ({ id: p.id, name: p.name })),
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    ];
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const IDEA_SORTS: Record<string, string> = {
  updated: "updated_at DESC",
  grant: "grant_fit DESC, updated_at DESC",
  buildability: "buildability DESC, updated_at DESC",
  iso: "iso_class ASC, updated_at DESC",
};

export async function listIdeas(
  db: D1Database,
  filter: { status?: string; iso_class?: string; next_sprint?: boolean; sort?: string },
): Promise<Idea[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    where.push("status = ?");
    params.push(filter.status);
  }
  if (filter.iso_class) {
    where.push("iso_class = ?");
    params.push(filter.iso_class);
  }
  if (filter.next_sprint) where.push("next_sprint = 1");
  const order = IDEA_SORTS[filter.sort ?? "updated"] ?? IDEA_SORTS.updated;
  const sql = `SELECT * FROM prototype_ideas ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT 500`;
  const { results } = await db.prepare(sql).bind(...params).all<IdeaRow>();
  return hydrateIdeas(db, results);
}

export async function getIdea(db: D1Database, id: string): Promise<Idea | null> {
  const row = await db.prepare("SELECT * FROM prototype_ideas WHERE id = ?").bind(id).first<IdeaRow>();
  return row ? ((await hydrateIdeas(db, [row]))[0] ?? null) : null;
}

export async function insertIdea(
  db: D1Database,
  data: {
    analysis: Analysis;
    grant_fit: number;
    buildability: number;
    iso_class: string | null;
    model: string;
    product_ids: string[];
  },
): Promise<Idea> {
  const id = crypto.randomUUID();
  const stamp = now();
  const statements = [
    db
      .prepare(
        `INSERT INTO prototype_ideas
          (id, title, status, approach, iso_class, grant_fit, buildability, next_sprint, notes,
           analysis, model, created_at, updated_at)
         VALUES (?, ?, 'draft', ?, ?, ?, ?, 0, '', ?, ?, ?, ?)`,
      )
      .bind(
        id,
        data.analysis.proposal.title,
        data.analysis.proposal.approach,
        data.iso_class,
        data.grant_fit,
        data.buildability,
        JSON.stringify(data.analysis),
        data.model,
        stamp,
        stamp,
      ),
    ...data.product_ids.map((productId) =>
      db.prepare("INSERT INTO idea_products (idea_id, product_id) VALUES (?, ?)").bind(id, productId),
    ),
  ];
  await db.batch(statements);
  const idea = await getIdea(db, id);
  if (!idea) throw new Error("Idén kunde inte läsas efter att den sparats.");
  return idea;
}

export type IdeaPatch = Partial<{
  title: string;
  status: IdeaStatus;
  notes: string;
  grant_fit: number;
  buildability: number;
  next_sprint: boolean;
  analysis: Analysis;
}>;

export async function patchIdea(db: D1Database, id: string, patch: IdeaPatch): Promise<Idea | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };
  if (patch.title !== undefined) add("title", patch.title);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.notes !== undefined) add("notes", patch.notes);
  if (patch.grant_fit !== undefined) add("grant_fit", patch.grant_fit);
  if (patch.buildability !== undefined) add("buildability", patch.buildability);
  if (patch.next_sprint !== undefined) add("next_sprint", patch.next_sprint ? 1 : 0);
  if (patch.analysis !== undefined) {
    add("analysis", JSON.stringify(patch.analysis));
    add("approach", patch.analysis.proposal.approach);
  }
  if (sets.length === 0) return getIdea(db, id);
  add("updated_at", now());
  const result = await db
    .prepare(`UPDATE prototype_ideas SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...params, id)
    .run();
  if (!result.meta.changes) return null;
  return getIdea(db, id);
}

export async function deleteIdea(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM prototype_ideas WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}
