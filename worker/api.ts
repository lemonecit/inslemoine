import { importCsv, importJson, recordsToProducts } from "../lib/admin/import";
import { isoClassTitle } from "../lib/admin/iso9999";
import { ideaToMarkdown } from "../lib/admin/markdown";
import {
  AnalysisSchema,
  AnalyzeRequestSchema,
  BrainstormRequestSchema,
  BrainstormResponseSchema,
  BulkProductsSchema,
  CheaperRequestSchema,
  CheaperResponseSchema,
  IdeaPatchSchema,
  ImportParseSchema,
  ProductInputSchema,
  RestoreRequestSchema,
  type Product,
} from "../lib/admin/schema";
import { buildabilityFromDifficulty, costSummary } from "../lib/admin/scoring";
import {
  addVersion,
  deleteIdea,
  deleteProduct,
  getIdea,
  getProducts,
  getVersionAnalysis,
  insertIdea,
  insertProducts,
  listIdeas,
  listProducts,
  listVersions,
  patchIdea,
  productsInClass,
  updateProduct,
} from "./db";
import type { Env } from "./env";
import { HttpError, badFormat, fail, json, notFound, parse, readJson, sameOrigin, SECURITY_HEADERS } from "./http";
import { handleFunding } from "./funding-api";
import { callLlm, extractJson } from "./llm";
import {
  ANALYSIS_SYSTEM,
  BRAINSTORM_SYSTEM,
  CHEAPER_SYSTEM,
  EXTRACT_SYSTEM,
  buildAnalysisPrompt,
  buildBrainstormPrompt,
  buildCheaperPrompt,
  buildExtractPrompt,
} from "./prompt";

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
  if (products.length === 0 && input.iso_class && !input.concept) {
    products = await productsInClass(env.DB, input.iso_class);
    if (products.length === 0) throw new HttpError(400, "Den ISO-klassen har inga produkter.");
  }

  const llm = await callLlm(env, {
    system: ANALYSIS_SYSTEM,
    user: buildAnalysisPrompt(products, input.focus, input.concept),
    maxTokens: 8000,
  });
  const parsed = AnalysisSchema.safeParse(extractJson(llm.text));
  if (!parsed.success) {
    console.error("Analysis validation", JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new HttpError(502, badFormat(parsed.error));
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

async function brainstorm(env: Env, body: unknown) {
  const input = parse(BrainstormRequestSchema, body);
  const known = input.iso_class ? await productsInClass(env.DB, input.iso_class, 8) : [];
  const llm = await callLlm(env, {
    system: BRAINSTORM_SYSTEM,
    user: buildBrainstormPrompt({
      need: input.need,
      isoClass: input.iso_class ? { code: input.iso_class, title: isoClassTitle(input.iso_class) } : undefined,
      maxUnitCost: input.max_unit_cost_eur,
      count: input.count,
      knownProducts: known,
    }),
    maxTokens: 5000,
  });
  const parsed = BrainstormResponseSchema.safeParse(extractJson(llm.text));
  if (!parsed.success) {
    console.error("Brainstorm validation", JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new HttpError(502, badFormat(parsed.error));
  }
  return { concepts: parsed.data.concepts, model: llm.model };
}

async function makeCheaper(env: Env, id: string, body: unknown) {
  const input = parse(CheaperRequestSchema, body);
  const idea = await getIdea(env.DB, id);
  if (!idea) throw new HttpError(404, "Idén finns inte.");

  const llm = await callLlm(env, {
    system: CHEAPER_SYSTEM,
    user: buildCheaperPrompt(idea.analysis, input.target_cost_eur, input.hint),
    maxTokens: 9000,
  });
  const parsed = CheaperResponseSchema.safeParse(extractJson(llm.text));
  if (!parsed.success) {
    console.error("Cheaper validation", JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new HttpError(502, badFormat(parsed.error));
  }

  const before = costSummary(idea.analysis).unit_cost_eur;
  const after = costSummary(parsed.data.analysis).unit_cost_eur;
  const updated = await addVersion(env.DB, id, parsed.data.analysis, "cheaper", {
    summary: parsed.data.summary,
    changes: parsed.data.changes,
  });
  if (!updated) throw new HttpError(404, "Idén finns inte.");
  // Modellen kan misslyckas med att sänka kostnaden : det visas i stället för att döljas.
  return { idea: updated, cost_before: before, cost_after: after, cheaper: before !== null && after !== null ? after < before : null };
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

    if (path === "/api/brainstorm" && method === "POST") {
      return json(await brainstorm(env, await readJson(request)));
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

    const ideaMatch = path.match(/^\/api\/ideas\/([\w-]{1,64})(\/export\.md|\/versions|\/cheaper|\/restore)?$/);
    if (ideaMatch) {
      const id = ideaMatch[1];
      const sub = ideaMatch[2];
      if (sub === "/export.md" && method === "GET") {
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
      if (sub === "/versions" && method === "GET") {
        if (!(await getIdea(env.DB, id))) return notFound();
        return json({ versions: await listVersions(env.DB, id) });
      }
      if (sub === "/cheaper" && method === "POST") {
        return json(await makeCheaper(env, id, await readJson(request)));
      }
      if (sub === "/restore" && method === "POST") {
        const { version } = parse(RestoreRequestSchema, await readJson(request));
        const analysis = await getVersionAnalysis(env.DB, id, version);
        if (!analysis) return notFound();
        const idea = await addVersion(env.DB, id, analysis, "restore", { summary: `Återställd från version ${version}.` });
        return idea ? json({ idea }) : notFound();
      }
      if (!sub) {
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

    const funding = await handleFunding(request, env, path, method, url);
    if (funding) return funding;

    return notFound();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.status, error.message, error.details);
    console.error("API error", error);
    return fail(500, "Något gick fel på servern.");
  }
}
