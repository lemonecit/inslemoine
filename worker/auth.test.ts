import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAccessJwt } from "./auth";

const TEAM = "foreningen.cloudflareaccess.com";
const AUD = "aud-123";
const EMAILS = ["admin@institut-lemoine.fr"];

const b64url = (data: string | Uint8Array) =>
  Buffer.from(data).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function makeKeys() {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = { ...((await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey), kid: "k1" };
  return { privateKey: pair.privateKey, jwk };
}

async function sign(privateKey: CryptoKey, payload: Record<string, unknown>, header = { alg: "RS256", kid: "k1" }) {
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`;
}

const NOW = 1_800_000_000;
const good = { iss: `https://${TEAM}`, aud: [AUD], email: "Admin@Institut-Lemoine.fr", exp: NOW + 600, nbf: NOW - 10 };

test("godkänner en giltig token (adressen jämförs utan skiftläge)", async () => {
  const { privateKey, jwk } = await makeKeys();
  const token = await sign(privateKey, good);
  const result = await verifyAccessJwt(token, { keys: [jwk], team: TEAM, aud: AUD, emails: EMAILS, now: NOW });
  assert.deepEqual(result, { ok: true, email: "admin@institut-lemoine.fr" });
});

test("nekar fel signatur, utgången token, fel publik, fel utfärdare och okänd adress", async () => {
  const { privateKey, jwk } = await makeKeys();
  const other = await makeKeys();
  const opts = { keys: [jwk], team: TEAM, aud: AUD, emails: EMAILS, now: NOW };

  const forged = await sign(other.privateKey, good);
  assert.equal((await verifyAccessJwt(forged, opts)).ok, false);

  const expired = await sign(privateKey, { ...good, exp: NOW - 3600 });
  assert.deepEqual(await verifyAccessJwt(expired, opts), { ok: false, reason: "expired" });

  const wrongAud = await sign(privateKey, { ...good, aud: ["annan"] });
  assert.deepEqual(await verifyAccessJwt(wrongAud, opts), { ok: false, reason: "audience" });

  const wrongIss = await sign(privateKey, { ...good, iss: "https://evil.cloudflareaccess.com" });
  assert.deepEqual(await verifyAccessJwt(wrongIss, opts), { ok: false, reason: "issuer" });

  const stranger = await sign(privateKey, { ...good, email: "annan@example.org" });
  assert.deepEqual(await verifyAccessJwt(stranger, opts), { ok: false, reason: "email" });
});

test("nekar alg=none och trasiga tokens", async () => {
  const { jwk } = await makeKeys();
  const opts = { keys: [jwk], team: TEAM, aud: AUD, emails: EMAILS, now: NOW };
  const none = `${b64url(JSON.stringify({ alg: "none", kid: "k1" }))}.${b64url(JSON.stringify(good))}.`;
  assert.equal((await verifyAccessJwt(none, opts)).ok, false);
  assert.equal((await verifyAccessJwt("skräp", opts)).ok, false);
  assert.equal((await verifyAccessJwt("a.b.c", opts)).ok, false);
});
