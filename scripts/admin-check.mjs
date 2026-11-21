// Test de bout en bout de l'outil d'administration (/admin/prototypes) contre un Worker local :
//   1. npm run build && npx wrangler d1 migrations apply DB --local
//   2. node scripts/mock-llm.mjs            (fausse IA)
//   3. npx wrangler dev --port 8787          (avec .dev.vars : ALLOW_LOCAL_DEV=1 + LLM_* vers la fausse IA)
//   4. node scripts/admin-check.mjs
// Vérifie le parcours complet, axe (WCAG 2.2 AA) à chaque étape, et la non-indexation.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.ADMIN_BASE ?? "http://127.0.0.1:8787";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const EXTREME = { textSize: "xlarge", spacing: "wide", font: "lexend", contrast: "dark" };

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" },
);
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

async function axe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async (tags) => {
    const r = await globalThis.axe.run(document, { runOnly: { type: "tag", values: tags } });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  }, TAGS);
  for (const v of violations) failures.push(`axe @ ${label}: ${v}`);
}

const api = (page, method, path, body) =>
  page.request.fetch(BASE + path, {
    method,
    headers: { Origin: BASE, "Content-Type": "application/json" },
    data: body,
  });

async function cleanup(page) {
  const { ideas } = await (await api(page, "GET", "/api/ideas")).json();
  for (const i of ideas) await api(page, "DELETE", `/api/ideas/${i.id}`);
  const { products } = await (await api(page, "GET", "/api/products")).json();
  for (const p of products) await api(page, "DELETE", `/api/products/${p.id}`);
}

// --- Parcours complet, ordinateur --------------------------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`erreur JS : ${e.message}`));
  page.on("console", (m) => {
    // Den ogiltiga ISO-koden i testet ger avsiktligt ett 400-svar.
    if (m.type() === "error" && !/status of 400/.test(m.text())) failures.push(`console : ${m.text()}`);
  });
  await cleanup(page);

  const response = await page.goto(`${BASE}/admin/prototypes`, { waitUntil: "networkidle" });
  check(/noindex/.test(response.headers()["x-robots-tag"] ?? ""), "X-Robots-Tag noindex manquant");
  check((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"), "meta robots noindex manquante");
  check((await page.locator("dialog[open]").count()) === 0, "la fenêtre de première visite ne doit pas s'ouvrir sur /admin");
  await page.getByRole("heading", { name: "Prototypanalys" }).waitFor();
  await page.getByText("Inga idéer ännu").waitFor();
  await axe(page, "idéer (vide)");

  // Produit saisi à la main
  await page.getByRole("link", { name: "Produkter" }).click();
  await page.getByRole("button", { name: "Ny produkt" }).click();
  await page.getByLabel("Produktnamn").fill("Kommunikationsenhet A");
  await page.getByLabel("ISO 9999-kod").fill("22 21 03");
  await page.getByLabel("Pris från (€)").fill("1200");
  await page.getByLabel("Funktion").fill("Tal från text");
  await page.getByLabel("Kända begränsningar").fill("Dyr specialhårdvara\nKräver licens");
  await axe(page, "produkter (formulär)");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await page.getByRole("cell", { name: /22 21 03/ }).waitFor();

  // ISO-kod ogiltig avvisas
  await page.getByRole("button", { name: "Ny produkt" }).click();
  await page.getByLabel("Produktnamn").fill("Fel");
  await page.getByLabel("ISO 9999-kod").fill("99 99");
  await page.getByRole("button", { name: "Spara", exact: true }).click();
  await page.getByRole("alert").getByText(/Ogiltig ISO 9999-kod/).waitFor();
  await page.getByRole("button", { name: "Avbryt" }).first().click();

  // Import CSV
  await page.getByRole("link", { name: "Importera" }).click();
  await page.getByRole("radio", { name: "CSV" }).check();
  await page.getByLabel("Innehåll").fill("namn;iso;pris;begränsningar\nSkärmläsare B;22 03 18;900;ej WCAG-anpassad\nKnappsats C;24 06;45;\n;;;");
  await page.getByRole("button", { name: "Förhandsgranska" }).click();
  await page.getByText("2 produkter hittades").waitFor();
  await axe(page, "importera (förhandsgranskning)");
  await page.getByRole("button", { name: /Spara 2 produkter/ }).click();
  await page.getByRole("cell", { name: /24 06/ }).waitFor();

  // Import text via AI
  await page.getByRole("link", { name: "Importera" }).click();
  await page.getByRole("radio", { name: "Klistra in text" }).check();
  await page.getByLabel("Innehåll").fill("Talapparat Z från Exempel AB, 1200–1500 euro.");
  await page.getByRole("button", { name: "Förhandsgranska" }).click();
  await page.getByText(/extraherade av AI/).waitFor();
  await page.getByRole("link", { name: "Produkter" }).click();

  // Analys
  await page.getByLabel("Välj Kommunikationsenhet A").check();
  await axe(page, "produkter (lista)");
  await page.getByRole("button", { name: /Analysera 1 markerade/ }).click();
  await page.getByRole("heading", { level: 2, name: "Webbläsarbaserad talsyntes (PWA)" }).waitFor({ timeout: 30000 });
  check(await page.evaluate(() => document.activeElement?.tagName === "H2"), "fokus ska flyttas till rubriken i den nya vyn");
  await page.getByRole("table", { name: /Pugh-matris/ }).waitFor();
  const totals = await page.getByRole("table", { name: /Pugh-matris/ }).locator("tfoot").innerText();
  check(totals.includes("+11"), `Pugh-summa fel (väntade +11 : 5+5+3+3+0) : ${totals}`);
  await axe(page, "idédetalj");

  // Materiallista : summan räknas av koden (2×4,5 + 6 + 12 = 27 € mot marknadspris 1 200 € = 98 %)
  const costline = () => page.locator(".admin-costline").innerText();
  check(/27 €/.test(await costline()) && /98 % billigare/.test(await costline()), `kostnadsraden fel : ${await costline()}`);
  await page.getByRole("table", { name: /Materiallista med antal/ }).waitFor();

  // Gör billigare : ny version med lägre kostnad, och den gamla kan återställas
  await page.getByRole("button", { name: "Gör billigare" }).click();
  await page.getByRole("heading", { name: "Resultat: version 2" }).waitFor({ timeout: 30000 });
  check(/99 % billigare/.test(await costline()), `kostnadsraden efter « billigare » fel : ${await costline()}`);
  check(await page.getByText("Hårdvaran är borttagen och driften förenklad.").first().isVisible(), "ändringslistan saknas");
  check(await page.getByText("Tog bort mikrokontrollern och höljet").first().isVisible(), "ändringarna visas inte");
  await axe(page, "idédetalj efter « gör billigare »");
  await page.getByRole("table", { name: /Versioner av idén/ }).waitFor();
  check((await page.getByRole("table", { name: /Versioner av idén/ }).locator("tbody tr").count()) === 2, "två versioner förväntades");
  await page.getByRole("button", { name: "Återställ version 1" }).click();
  await page.waitForFunction(() => /Version\s*3/.test(document.querySelector(".admin-costline")?.textContent ?? ""), null, { timeout: 15000 });
  check(/27 €/.test(await costline()), `återställningen ska ge tillbaka kostnaden 27 € : ${await costline()}`);

  // Redigera och spara
  await page.getByLabel("Titel").fill("Talsyntes för alla");
  await page.getByLabel("Status").selectOption("prioritized");
  await page.getByLabel("Markera för nästa sprint").check();
  await page.getByLabel("Egna tekniska anteckningar").fill("Testa med riktiga användare.");
  await page.getByRole("button", { name: "Spara ändringar" }).click();
  await page.getByText("Ändringarna är sparade.").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 2, name: "Talsyntes för alla" }).waitFor();
  check((await page.getByLabel("Egna tekniska anteckningar").inputValue()) === "Testa med riktiga användare.", "anteckningar sparades inte");

  // Lista, filter, export
  await page.getByRole("link", { name: "← Alla idéer" }).click();
  await page.getByLabel("Bara nästa sprint").check();
  await page.getByRole("link", { name: "Talsyntes för alla" }).waitFor();
  await page.getByLabel("Status").selectOption("archived");
  await page.getByText("Inga idéer ännu").waitFor();
  await page.getByLabel("Status").selectOption("prioritized");
  await axe(page, "idéer (lista)");

  const { ideas } = await (await api(page, "GET", "/api/ideas")).json();
  const md = await (await api(page, "GET", `/api/ideas/${ideas[0].id}/export.md`)).text();
  for (const part of ["# Talsyntes för alla", "## SWOT", "## Pugh-matris", "Testa med riktiga användare."]) {
    check(md.includes(part), `Markdown saknar « ${part} »`);
  }

  // Raderingen kräver bekräftelse
  await page.getByRole("link", { name: "Talsyntes för alla" }).click();
  await page.getByRole("button", { name: "Ta bort idén" }).click();
  await page.getByRole("button", { name: "Ja, ta bort idén" }).click();
  await page.getByText("Inga idéer ännu").waitFor();

  // Brainstorm : ingen startprodukt behövs
  await page.getByRole("link", { name: "Brainstorma" }).click();
  await page.getByLabel("Behov eller uppgift").fill("Personer som inte kan tala behöver kommunicera med omgivningen.");
  await axe(page, "brainstorma (formulär)");
  await page.getByRole("button", { name: "Ta fram idéer" }).click();
  await page.getByRole("list", { name: "Föreslagna idéer" }).waitFor({ timeout: 30000 });
  check((await page.getByRole("list", { name: "Föreslagna idéer" }).locator("> li").count()) === 3, "tre koncept förväntades");
  check(await page.getByText(/ungefär 99 % billigare/).first().isVisible(), "besparingen för konceptet saknas");
  await axe(page, "brainstorma (resultat)");
  await page.getByRole("button", { name: /Utveckla till idé: Kommunikationsapp för smartphone/ }).click();
  await page.getByRole("heading", { level: 2, name: "Webbläsarbaserad talsyntes (PWA)" }).waitFor({ timeout: 30000 });
  await page.getByRole("table", { name: /Materiallista med antal/ }).waitFor();

  await cleanup(page);
  await context.close();
}

// --- Mobil 320 px, mycket stor text och kontrast ---------------------------------------
{
  const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
  await context.addInitScript((prefs) => localStorage.setItem("ila-a11y", JSON.stringify({ ...prefs, at: Date.now() })), EXTREME);
  const page = await context.newPage();
  const { product } = await (await api(page, "POST", "/api/products", { name: "Mobiltest", iso_code: "22 03", function: "x".repeat(300) })).json();
  const { idea } = await (await api(page, "POST", "/api/analyze", { product_ids: [product.id] })).json();
  const noOverflow = async (label) =>
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), `horisontell scroll på 320 px : ${label}`);

  await page.goto(`${BASE}/admin/prototypes#produkter`, { waitUntil: "networkidle" });
  await page.getByRole("cell", { name: /22 03/ }).waitFor();
  await noOverflow("produkter");
  await axe(page, "produkter, 320 px, extremt läge");
  await page.getByRole("button", { name: "Ny produkt" }).click();
  await axe(page, "produktformulär, 320 px, extremt läge");

  await page.goto(`${BASE}/admin/prototypes#ide/${idea.id}`, { waitUntil: "networkidle" });
  await page.getByRole("table", { name: /Materiallista med antal/ }).waitFor();
  await noOverflow("idédetalj");
  await axe(page, "idédetalj, 320 px, extremt läge");

  await page.goto(`${BASE}/admin/prototypes#brainstorma`, { waitUntil: "networkidle" });
  await page.getByLabel("Behov eller uppgift").waitFor();
  await noOverflow("brainstorma");
  await axe(page, "brainstorma, 320 px, extremt läge");
  await cleanup(page);
  await context.close();
}

// --- Skydd ------------------------------------------------------------------------------
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const noOrigin = await page.request.fetch(`${BASE}/api/products`, { method: "POST", headers: { "Content-Type": "application/json" }, data: { name: "x" } });
  check(noOrigin.status() === 403, `POST utan Origin ska nekas (fick ${noOrigin.status()})`);
  const evil = await page.request.fetch(`${BASE}/api/products`, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, data: { name: "x" } });
  check(evil.status() === 403, `POST från annan origin ska nekas (fick ${evil.status()})`);
  const sitemap = await (await page.request.get(`${BASE}/sitemap.xml`)).text();
  const robots = await (await page.request.get(`${BASE}/robots.txt`)).text();
  check(!/admin/i.test(sitemap + robots), "/admin får inte nämnas i sitemap.xml eller robots.txt");
  const home = await page.request.get(`${BASE}/`);
  check(home.status() === 200 && !home.headers()["x-robots-tag"], "den publika sidan ska vara orörd");
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} problem :`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("Adminverktyget : alla kontroller godkända.");
