import {
  CallInputSchema,
  CallInputSchema as CallSchema,
  ChecklistCreateSchema,
  ChecklistPatchSchema,
  DraftPatchSchema,
  DraftRequestSchema,
  DraftResponseSchema,
  ExtractRequestSchema,
  MatchRequestSchema,
  MatchResponseSchema,
  ProfilePutSchema,
  buildChecklistLabels,
  buildIcs,
} from "../lib/admin/funding";
import {
  addChecklistItems,
  deleteCall,
  deleteChecklistItem,
  deleteDraft,
  getCallDetail,
  getCallRow,
  getDraft,
  getProfile,
  insertCall,
  insertDraft,
  listCalls,
  listChecklist,
  listMatches,
  patchChecklistItem,
  patchDraft,
  setProfile,
  updateCall,
  upsertMatches,
} from "./funding-db";
import { getIdea, listIdeas } from "./db";
import type { Env } from "./env";
import { HttpError, SECURITY_HEADERS, badFormat, json, notFound, parse, readJson } from "./http";
import { callLlm, extractJson } from "./llm";
import {
  CALL_EXTRACT_SYSTEM,
  DRAFT_SYSTEM,
  MATCH_SYSTEM,
  buildCallExtractPrompt,
  buildDraftPrompt,
  buildMatchPrompt,
} from "./funding-prompts";
import type { Idea } from "../lib/admin/schema";

const ID = "([\\w-]{1,64})";

function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "utkast"
  );
}

async function extractCall(env: Env, body: unknown) {
  const { text, url } = parse(ExtractRequestSchema, body);
  const llm = await callLlm(env, { system: CALL_EXTRACT_SYSTEM, user: buildCallExtractPrompt(text, url), maxTokens: 3000 });
  const parsed = CallSchema.safeParse(extractJson(llm.text));
  if (!parsed.success) {
    console.error("Call validation", JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new HttpError(502, badFormat(parsed.error));
  }
  const call = { ...parsed.data, url: parsed.data.url || (/^https?:\/\//i.test(url) ? url : ""), status: "new" as const };
  const warnings = ["AI:n kan ha missförstått texten. Kontrollera datum, belopp och krav mot källan innan du sparar."];
  if (!call.deadline) warnings.push("Ingen deadline hittades i texten. Fyll i den själv om den finns.");
  return { call, warnings, model: llm.model };
}

async function matchCall(env: Env, id: string, body: unknown) {
  const input = parse(MatchRequestSchema, body);
  const call = await getCallRow(env.DB, id);
  if (!call) throw new HttpError(404, "Utlysningen finns inte.");

  let ideas: Idea[];
  if (input.idea_ids.length) {
    ideas = (await Promise.all(input.idea_ids.map((i) => getIdea(env.DB, i)))).filter((i): i is Idea => i !== null);
  } else {
    ideas = (await listIdeas(env.DB, { sort: "grant" })).filter((i) => i.status !== "archived").slice(0, 10);
  }
  if (ideas.length === 0) throw new HttpError(400, "Det finns inga idéer att matcha mot. Skapa en idé först.");

  const profile = await getProfile(env.DB);
  const llm = await callLlm(env, { system: MATCH_SYSTEM, user: buildMatchPrompt(profile, call, ideas), maxTokens: 4000 });
  const parsed = MatchResponseSchema.safeParse(extractJson(llm.text));
  if (!parsed.success) {
    console.error("Match validation", JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new HttpError(502, badFormat(parsed.error));
  }
  const known = new Set(ideas.map((i) => i.id));
  const matches = parsed.data.matches.filter((m) => known.has(m.idea_id));
  if (matches.length === 0) throw new HttpError(502, "AI-svaret innehöll ingen användbar matchning. Försök igen.");
  await upsertMatches(env.DB, id, matches, llm.model);
  return { matches: await listMatches(env.DB, id) };
}

async function draftApplication(env: Env, id: string, body: unknown) {
  const input = parse(DraftRequestSchema, body);
  const call = await getCallRow(env.DB, id);
  if (!call) throw new HttpError(404, "Utlysningen finns inte.");
  const idea = input.idea_id ? await getIdea(env.DB, input.idea_id) : null;
  if (input.idea_id && !idea) throw new HttpError(404, "Idén finns inte.");

  const profile = await getProfile(env.DB);
  const llm = await callLlm(env, {
    system: DRAFT_SYSTEM,
    user: buildDraftPrompt({ profile, call, idea: idea ?? undefined, language: input.language, instructions: input.instructions }),
    maxTokens: 8000,
  });
  const parsed = DraftResponseSchema.safeParse(extractJson(llm.text));
  if (!parsed.success) {
    console.error("Draft validation", JSON.stringify(parsed.error.issues.slice(0, 5)));
    throw new HttpError(502, badFormat(parsed.error));
  }
  return insertDraft(env.DB, {
    call_id: id,
    idea_id: idea?.id ?? null,
    language: input.language,
    title: parsed.data.title,
    content: parsed.data.content,
    model: llm.model,
  });
}

// Returnerar null om sökvägen inte tillhör finansieringsdelen, så att huvudroutern kan svara 404.
export async function handleFunding(request: Request, env: Env, path: string, method: string, url: URL): Promise<Response | null> {
  if (path === "/api/profile") {
    if (method === "GET") return json({ profile: await getProfile(env.DB) });
    if (method === "PUT") {
      const { profile } = parse(ProfilePutSchema, await readJson(request));
      await setProfile(env.DB, profile);
      return json({ profile });
    }
  }

  if (path === "/api/calls") {
    if (method === "GET") {
      const calls = await listCalls(env.DB, {
        status: url.searchParams.get("status") ?? undefined,
        kind: url.searchParams.get("kind") ?? undefined,
        sort: url.searchParams.get("sort") ?? undefined,
        open_only: url.searchParams.get("open_only") === "1",
      });
      return json({ calls });
    }
    if (method === "POST") {
      const body = (await readJson(request)) as Record<string, unknown>;
      const input = parse(CallInputSchema, body);
      const source = typeof body?.source_text === "string" ? body.source_text : "";
      return json({ call: await insertCall(env.DB, input, source) }, 201);
    }
  }

  if (path === "/api/calls/calendar.ics" && method === "GET") {
    const calls = await listCalls(env.DB, { open_only: true, sort: "deadline" });
    return new Response(buildIcs(calls, new Date()), {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="finansiering.ics"',
      },
    });
  }

  if (path === "/api/calls/extract" && method === "POST") return json(await extractCall(env, await readJson(request)));

  const callMatch = path.match(new RegExp(`^/api/calls/${ID}(?:/(match|drafts|checklist(?:/generate|/${ID})?))?$`));
  if (callMatch) {
    const [, id, sub, itemId] = callMatch;

    if (!sub) {
      if (method === "GET") {
        const detail = await getCallDetail(env.DB, id);
        return detail ? json({ call: detail }) : notFound();
      }
      if (method === "PATCH" || method === "PUT") {
        const call = await updateCall(env.DB, id, parse(CallInputSchema, await readJson(request)));
        return call ? json({ call }) : notFound();
      }
      if (method === "DELETE") return (await deleteCall(env.DB, id)) ? json({ ok: true }) : notFound();
    }

    if (sub === "match" && method === "POST") return json(await matchCall(env, id, await readJson(request)));
    if (sub === "drafts" && method === "POST") return json({ draft: await draftApplication(env, id, await readJson(request)) }, 201);

    if (sub?.startsWith("checklist")) {
      if (!(await getCallRow(env.DB, id))) return notFound();
      if (sub === "checklist" && method === "POST") {
        const item = parse(ChecklistCreateSchema, await readJson(request));
        await addChecklistItems(env.DB, id, [item]);
        return json({ checklist: await listChecklist(env.DB, id) }, 201);
      }
      if (sub === "checklist/generate" && method === "POST") {
        const body = (await readJson(request)) as { include_standard?: boolean };
        const call = await getCallRow(env.DB, id);
        const existing = (await listChecklist(env.DB, id)).map((i) => i.label);
        const labels = buildChecklistLabels(call?.requirements ?? [], existing, body?.include_standard !== false);
        await addChecklistItems(env.DB, id, labels.map((label) => ({ label })));
        return json({ checklist: await listChecklist(env.DB, id) });
      }
      if (itemId && method === "PATCH") {
        const ok = await patchChecklistItem(env.DB, id, itemId, parse(ChecklistPatchSchema, await readJson(request)));
        return ok ? json({ checklist: await listChecklist(env.DB, id) }) : notFound();
      }
      if (itemId && method === "DELETE") {
        return (await deleteChecklistItem(env.DB, id, itemId)) ? json({ checklist: await listChecklist(env.DB, id) }) : notFound();
      }
    }
  }

  const draftMatch = path.match(new RegExp(`^/api/drafts/${ID}(/export\\.md)?$`));
  if (draftMatch) {
    const [, id, exportMd] = draftMatch;
    if (exportMd && method === "GET") {
      const draft = await getDraft(env.DB, id);
      if (!draft) return notFound();
      return new Response(`# ${draft.title}\n\n${draft.content}\n`, {
        headers: {
          ...SECURITY_HEADERS,
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${slug(draft.title)}.md"`,
        },
      });
    }
    if (!exportMd) {
      if (method === "GET") {
        const draft = await getDraft(env.DB, id);
        return draft ? json({ draft }) : notFound();
      }
      if (method === "PATCH") {
        const draft = await patchDraft(env.DB, id, parse(DraftPatchSchema, await readJson(request)));
        return draft ? json({ draft }) : notFound();
      }
      if (method === "DELETE") return (await deleteDraft(env.DB, id)) ? json({ ok: true }) : notFound();
    }
  }

  return null;
}
