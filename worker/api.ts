import { ZodError, type ZodType } from "zod";
import { importCsv, importJson, recordsToProducts } from "../lib/admin/import";
import { ideaToMarkdown } from "../lib/admin/markdown";
import {
  AnalysisSchema,
  AnalyzeRequestSchema,
  BulkProductsSchema,
  IdeaPatchSchema,
  ImportParseSchema,
  ProductInputSchema,
  type Product,
} from "../lib/admin/schema";
import { buildabilityFromDifficulty } from "../lib/admin/scoring";
import {
  deleteIdea,
  deleteProduct,
  getIdea,
  getProducts,
  insertIdea,
  insertProducts,
  listIdeas,
  listProducts,
  patchIdea,
  productsInClass,
  updateProduct,
} from "./db";
import type { Env } from "./env";
import { HttpError, fail, json, notFound, readJson, sameOrigin, SECURITY_HEADERS } from "./http";
import { callLlm, extractJson } from "./llm";
import { ANALYSIS_SYSTEM, EXTRACT_SYSTEM, buildAnalysisPrompt, buildExtractPrompt } from "./prompt";

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new HttpError(
    400,
    "Ogiltiga uppgifter.",
    (result.error as ZodError).issues.slice(0, 8).map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function analyze(env: Env, body: unknown) {
  const input = parse(AnalyzeRequestSchema, body);
  const ids = [...new Set(input.product_ids)];

  let products: Product[] = await getProducts(env.DB, ids);
  if (products.length !== ids.length) throw new HttpError(404, "En vald produkt finns inte längre.");
  if (products.length === 0 && input.iso_class) products = await productsInClass(env.DB, input.iso_class);
  if (products.length === 0) {
    throw new HttpError(400, "Välj minst en produkt, eller en ISO-klass som har produkter.");
  }

  const llm = await callLlm(env, {
    system: ANALYSIS_SYSTEM,
    user: buildAnalysisPrompt(products, input.focus),
    maxTokens: 7000,
  });
  const parsed = AnalysisSchema.safeParse(extractJson(llm.text));
  if (!parsed.success) {
    console.error("Analysis validation", JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new HttpError(502, "AI-svaret hade fel format. Försök igen.");
  }

  const analysis = parsed.data;
  return insertIdea(env.DB, {
    analysis,
    grant_fit: analysis.impact.grant_fit,
    buildability: buildabilityFromDifficulty(analysis.feasibility.difficulty),
    iso_class: input.iso_class ?? mostCommon(products.map((p) => p.iso_class)),
    model: llm.model,
    product_ids: products.map((p) => p.id),
  });
}

async function parseImport(env: Env, body: unknown) {
  const { format, content } = parse(ImportParseSchema, body);
  if (format === "csv") return importCsv(content);
  if (format === "json") return importJson(content);

  const llm = await callLlm(env, {
    system: EXTRACT_SYSTEM,
    user: buildExtractPrompt(content),
    maxTokens: 6000,
  });
  const data = extractJson(llm.text) as { products?: unknown };
  if (!Array.isArray(data.products)) throw new HttpError(502, "AI-svaret saknade produktlistan.");
  const result = recordsToProducts(data.products);
  result.warnings.unshift("Posterna är extraherade av AI : kontrollera dem innan du sparar.");
  return result;
}

function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "prototyp"
  );
}

export async function handleApi(request: Request, env: Env, email: string): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname.replace(/\/$/, "");

  if (method !== "GET" && method !== "HEAD" && !sameOrigin(request)) {
    return fail(403, "Ändrande anrop måste komma från adminsidan.");
  }

  try {
    if (path === "/api/status" && method === "GET") {
      const llmConfigured = Boolean(env.LLM_PROVIDER && env.LLM_API_KEY && env.LLM_MODEL);
      return json({ email, llm_configured: llmConfigured });
    }

    if (path === "/api/products") {
      if (method === "GET") {
        const iso = url.searchParams.get("iso_class") ?? undefined;
        const q = url.searchParams.get("q")?.trim().slice(0, 100) || undefined;
        return json({ products: await listProducts(env.DB, { iso_class: iso, q }) });
      }
      if (method === "POST") {
        const input = parse(ProductInputSchema, await readJson(request));
        const [product] = await insertProducts(env.DB, [input]);
        return json({ product }, 201);
      }
    }

    if (path === "/api/products/bulk" && method === "POST") {
      const { products } = parse(BulkProductsSchema, await readJson(request));
      return json({ products: await insertProducts(env.DB, products) }, 201);
    }

    const productMatch = path.match(/^\/api\/products\/([\w-]{1,64})$/);
    if (productMatch) {
      const id = productMatch[1];
      if (method === "PATCH" || method === "PUT") {
        const input = parse(ProductInputSchema, await readJson(request));
        const product = await updateProduct(env.DB, id, input);
        return product ? json({ product }) : notFound();
      }
      if (method === "DELETE") {
        return (await deleteProduct(env.DB, id)) ? json({ ok: true }) : notFound();
      }
    }

    if (path === "/api/import/parse" && method === "POST") {
      return json(await parseImport(env, await readJson(request)));
    }

    if (path === "/api/analyze" && method === "POST") {
      return json({ idea: await analyze(env, await readJson(request)) }, 201);
    }

    if (path === "/api/ideas" && method === "GET") {
      const ideas = await listIdeas(env.DB, {
        status: url.searchParams.get("status") ?? undefined,
        iso_class: url.searchParams.get("iso_class") ?? undefined,
        next_sprint: url.searchParams.get("next_sprint") === "1",
        sort: url.searchParams.get("sort") ?? undefined,
      });
      return json({ ideas });
    }

    const ideaMatch = path.match(/^\/api\/ideas\/([\w-]{1,64})(\/export\.md)?$/);
    if (ideaMatch) {
      const id = ideaMatch[1];
      if (ideaMatch[2] && method === "GET") {
        const idea = await getIdea(env.DB, id);
        if (!idea) return notFound();
        return new Response(ideaToMarkdown(idea), {
          headers: {
            ...SECURITY_HEADERS,
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="${slug(idea.title)}.md"`,
          },
        });
      }
      if (!ideaMatch[2]) {
        if (method === "GET") {
          const idea = await getIdea(env.DB, id);
          return idea ? json({ idea }) : notFound();
        }
        if (method === "PATCH") {
          const patch = parse(IdeaPatchSchema, await readJson(request));
          const idea = await patchIdea(env.DB, id, patch);
          return idea ? json({ idea }) : notFound();
        }
        if (method === "DELETE") {
          return (await deleteIdea(env.DB, id)) ? json({ ok: true }) : notFound();
        }
      }
    }

    return notFound();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.message, error.details);
    console.error("API error", error);
    return fail(500, "Något gick fel på servern.");
  }
}
