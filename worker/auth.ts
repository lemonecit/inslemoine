import type { Env } from "./env";

type AccessJwk = JsonWebKey & { kid?: string };

export type VerifyOptions = {
  keys: AccessJwk[];
  team: string; // "foreningen.cloudflareaccess.com"
  aud: string;
  emails: string[];
  now?: number; // sekunder sedan epoch
};

export type VerifyResult = { ok: true; email: string } | { ok: false; reason: string };

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Kontrollerar Cloudflare Access-token: signatur (RS256), utfärdare, publik (aud), giltighetstid
// och att adressen finns i listan över administratörer.
export async function verifyAccessJwt(token: string, options: VerifyOptions): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "token-format" };

  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (!header || !payload) return { ok: false, reason: "token-format" };
  if (header.alg !== "RS256") return { ok: false, reason: "alg" };

  const key = options.keys.find((k) => k.kid === header.kid);
  if (!key) return { ok: false, reason: "kid" };

  let valid = false;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return { ok: false, reason: "signature" };
  }
  if (!valid) return { ok: false, reason: "signature" };

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const skew = 30;
  if (typeof payload.exp !== "number" || payload.exp + skew < now) return { ok: false, reason: "expired" };
  if (typeof payload.nbf === "number" && payload.nbf - skew > now) return { ok: false, reason: "not-yet-valid" };
  if (payload.iss !== `https://${options.team}`) return { ok: false, reason: "issuer" };

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(options.aud)) return { ok: false, reason: "audience" };

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!email || !options.emails.includes(email)) return { ok: false, reason: "email" };

  return { ok: true, email };
}

let certCache: { team: string; at: number; keys: AccessJwk[] } | undefined;
const CERT_TTL_MS = 60 * 60 * 1000;

async function loadKeys(team: string, force: boolean): Promise<AccessJwk[]> {
  if (!force && certCache && certCache.team === team && Date.now() - certCache.at < CERT_TTL_MS) {
    return certCache.keys;
  }
  const response = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs: ${response.status}`);
  const data = (await response.json()) as { keys?: AccessJwk[] };
  certCache = { team, at: Date.now(), keys: data.keys ?? [] };
  return certCache.keys;
}

export type AuthResult = { ok: true; email: string } | { ok: false; reason: string };

const TEAM_PATTERN = /^[a-z0-9-]+\.cloudflareaccess\.com$/;

// Fail closed: allt annat än en bevisat giltig administratör nekas.
export async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  const url = new URL(request.url);

  if (env.ALLOW_LOCAL_DEV === "1" && ["localhost", "127.0.0.1"].includes(url.hostname)) {
    return { ok: true, email: "dev@localhost" };
  }

  const team = (env.ACCESS_TEAM_DOMAIN ?? "").trim().toLowerCase();
  const aud = (env.ACCESS_AUD ?? "").trim();
  const emails = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!TEAM_PATTERN.test(team) || !aud || emails.length === 0) {
    return { ok: false, reason: "not-configured" };
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, reason: "no-token" };

  try {
    let result = await verifyAccessJwt(token, { keys: await loadKeys(team, false), team, aud, emails });
    // Nycklarna roteras ibland : försök en gång till med nyhämtade nycklar.
    if (!result.ok && result.reason === "kid") {
      result = await verifyAccessJwt(token, { keys: await loadKeys(team, true), team, aud, emails });
    }
    return result;
  } catch {
    return { ok: false, reason: "certs-unavailable" };
  }
}
