import type { Env } from "./env";
import { HttpError } from "./http";

export type LlmRequest = {
  system: string;
  user: string;
  maxTokens: number;
};

export type LlmResponse = { text: string; model: string };

function config(env: Env) {
  const provider = (env.LLM_PROVIDER ?? "").toLowerCase();
  // Städa bort blanktecken, radbrytningar och citattecken som kan ha följt med vid inklistring.
  const apiKey = (env.LLM_API_KEY ?? "").replace(/^["'\s]+|["'\s]+$/g, "");
  const model = (env.LLM_MODEL ?? "").trim();
  // Riktiga nycklar består bara av bokstäver, siffror, bindestreck och understreck. Ett dolt tecken
  // från inklistringen får annars leverantörens brandvägg att svara med ett tomt 400.
  if (apiKey) {
    const invalid = [...apiKey].filter((ch) => !/[A-Za-z0-9_-]/.test(ch)).length;
    if (invalid > 0 || apiKey.length < 20 || apiKey.length > 400) {
      throw new HttpError(
        503,
        `LLM_API_KEY ser ogiltig ut (längd ${apiKey.length}, ${invalid} ogiltiga tecken). Skapa en ny nyckel och lägg den med « wrangler secret put LLM_API_KEY --name institut-lemoine ».`,
      );
    }
  }
  if (!["anthropic", "openai"].includes(provider) || !apiKey || !model) {
    throw new HttpError(
      503,
      "AI-motorn är inte konfigurerad. Sätt LLM_PROVIDER (anthropic eller openai), LLM_MODEL och hemligheten LLM_API_KEY.",
    );
  }
  const base = (env.LLM_BASE_URL ?? "").trim().replace(/\/$/, "");
  // http:// tillåts bara mot den egna datorn (lokal utveckling med en låtsas-AI).
  if (base && !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(base + "/")) {
    throw new HttpError(503, "LLM_BASE_URL måste börja med https://");
  }
  return { provider, apiKey, model, base };
}

// Ett enda anrop, ingen ström : analysen sparas först när hela svaret är kontrollerat.
export async function callLlm(env: Env, request: LlmRequest): Promise<LlmResponse> {
  const { provider, apiKey, model, base } = config(env);

  const init: RequestInit =
    provider === "anthropic"
      ? {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: request.maxTokens,
            system: request.system,
            messages: [{ role: "user", content: request.user }],
          }),
        }
      : {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: request.system },
              { role: "user", content: request.user },
            ],
            response_format: { type: "json_object" },
          }),
        };

  const url =
    provider === "anthropic"
      ? `${base || "https://api.anthropic.com"}/v1/messages`
      : `${base || "https://api.openai.com/v1"}/chat/completions`;

  // Vissa leverantörer och brandväggar avvisar anrop utan User-Agent med ett tomt 400-svar.
  const headers = new Headers(init.headers);
  headers.set("user-agent", "institut-lemoine-admin/1.0");
  headers.set("accept", "application/json");

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(150_000) });
  } catch {
    throw new HttpError(504, "AI-motorn svarade inte i tid. Försök igen.");
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 2000);
    const responseHeaders = [...response.headers.entries()].map(([k, v]) => `${k}=${v.slice(0, 60)}`).join("; ");
    console.error(
      `LLM error ${response.status} ${response.statusText} host=${new URL(url).host}: ${body.slice(0, 500) || "(tomt svar)"} [headers: ${responseHeaders || "inga"}]`,
    );
    // Leverantörens felmeddelande (t.ex. fel modellnamn eller saknat saldo) visas för administratören.
    // Det innehåller aldrig nyckeln : OpenAI och Anthropic maskerar den.
    let detail = "";
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } | string };
      detail = typeof parsed.error === "string" ? parsed.error : (parsed.error?.message ?? "");
    } catch {
      // Svaret var inte JSON.
    }
    detail = detail.replace(/sk-[A-Za-z0-9_*.-]{6,}/g, "sk-…").slice(0, 300);
    throw new HttpError(502, `AI-motorn svarade med fel (${response.status})${detail ? `: ${detail}` : ". Kontrollera nyckel, modell och saldo."}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
    choices?: { message?: { content?: string } }[];
  };
  const text =
    provider === "anthropic"
      ? (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("")
      : (data.choices?.[0]?.message?.content ?? "");

  if (!text.trim()) throw new HttpError(502, "AI-motorn gav ett tomt svar.");
  return { text, model };
}

// Plockar ut JSON-objektet även om modellen har lagt text eller kodstaket runt det.
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new HttpError(502, "AI-svaret innehöll ingen JSON.");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "AI-svaret var inte giltig JSON. Försök igen.");
  }
}
