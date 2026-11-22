import type { ZodError, ZodType } from "zod";

export const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS },
  });
}

export function fail(status: number, message: string, details?: unknown): Response {
  return json({ error: message, details }, status);
}

export function notFound(): Response {
  return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
}

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Skyddar mot att en annan webbplats får webbläsaren att skicka ändringar med administratörens
// inloggning : ändrande anrop måste komma från samma adress.
export function sameOrigin(request: Request): boolean {
  if (request.headers.get("Sec-Fetch-Site") === "same-origin") return true;
  const origin = request.headers.get("Origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export async function readJson(request: Request): Promise<unknown> {
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Innehållet måste vara JSON.");
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Ogiltig JSON.");
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new HttpError(
    400,
    "Ogiltiga uppgifter.",
    (result.error as ZodError).issues.slice(0, 8).map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

// Säger vilket fält i ett AI-svar som inte stämde, så att felet går att åtgärda utan att gissa.
export function badFormat(error: ZodError): string {
  const where = error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "svaret"}: ${i.message}`)
    .join("; ");
  return `AI-svaret hade fel format (${where}). Försök igen.`;
}
