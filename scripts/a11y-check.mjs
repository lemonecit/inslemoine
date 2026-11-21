// Contrôle automatique d'accessibilité et de confidentialité sur le site exporté (out/).
// Usage : npm run build && npm run test:a11y
//
// Pour chaque scénario : axe-core (WCAG 2.2 AA + bonnes pratiques) doit ne trouver aucune
// violation. On vérifie aussi les promesses de la politique de confidentialité : aucune requête
// vers un autre domaine, aucun cookie, aucune erreur de console ni réponse HTTP en erreur.
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import handler from "serve-handler";
import { chromium } from "playwright-core";

const OUT = "out";
if (!existsSync(`${OUT}/index.html`)) {
  console.error("Le dossier out/ est absent : lancez d'abord `npm run build`.");
  process.exit(2);
}

const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

const server = createServer((req, res) => handler(req, res, { public: OUT }));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const baseHost = new URL(base).host;

const launch = process.env.CHROME_PATH
  ? { executablePath: process.env.CHROME_PATH }
  : { channel: "chrome" };
const browser = await chromium.launch(launch);

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const SMALLEST = { width: 320, height: 640 };
const EXTREME = { textSize: "xlarge", spacing: "wide", font: "lexend", contrast: "dark" };

const scenarios = [
  { name: "Accueil, ordinateur", path: "/" },
  {
    name: "Accueil, première visite (fenêtre d'information ouverte)",
    path: "/",
    firstVisit: true,
    setup: (page) => page.waitForSelector("dialog.consent[open]"),
  },
  { name: "Accueil, mobile", path: "/", viewport: MOBILE, noOverflow: true },
  {
    name: "Accueil, mobile, menu ouvert",
    path: "/",
    viewport: MOBILE,
    setup: (page) => page.click(".nav-toggle"),
  },
  {
    name: "Accueil, 320 px, texte très grand, contraste jaune sur noir, menu ouvert",
    path: "/",
    viewport: SMALLEST,
    prefs: EXTREME,
    noOverflow: true,
    setup: (page) => page.click(".nav-toggle"),
  },
  { name: "Accueil, contraste noir sur blanc", path: "/", prefs: { contrast: "high" } },
  {
    name: "Accueil, menu Accessibilité ouvert",
    path: "/",
    setup: (page) => page.click(".a11y-toggle"),
  },
  {
    name: "Accueil, loupe au clavier active",
    path: "/",
    prefs: { magnifier: "on" },
    setup: async (page) => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.waitForSelector(".magnifier");
    },
  },
  {
    name: "Mode « Lire en grand »",
    path: "/",
    prefs: { magnifier: "on" },
    setup: async (page) => {
      await page.focus('[data-read-section="qui-sommes-nous"]');
      await page.keyboard.press("Enter");
      await page.waitForSelector("dialog.reader[open]");
    },
  },
  {
    name: "Lecteur PDF accessible",
    path: "/",
    setup: async (page) => {
      await page.focus(".pdf-actions .button-primary");
      await page.keyboard.press("Enter");
      await page.waitForSelector("dialog .reader-body h3", { timeout: 20000 });
    },
  },
  { name: "Mentions légales", path: "/mentions-legales" },
  { name: "Politique de confidentialité", path: "/confidentialite", viewport: MOBILE },
  { name: "Déclaration d'accessibilité", path: "/declaration-accessibilite" },
  { name: "Page 404", path: "/page-inexistante", expectStatus: 404 },
];

async function run(scenario) {
  const context = await browser.newContext({ viewport: scenario.viewport ?? DESKTOP });
  await context.addInitScript(
    ({ prefs, acknowledged }) => {
      try {
        if (acknowledged) {
          localStorage.setItem("ila-consent", JSON.stringify({ at: Date.now(), choices: {} }));
        }
        if (prefs) localStorage.setItem("ila-a11y", JSON.stringify({ ...prefs, at: Date.now() }));
      } catch {
        // Stockage indisponible : le scénario s'exécute avec les réglages par défaut.
      }
    },
    { prefs: scenario.prefs, acknowledged: !scenario.firstVisit },
  );

  const page = await context.newPage();
  const problems = [];
  const hosts = new Set();
  const expected = scenario.expectStatus ? base + scenario.path : null;

  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url() !== expected) {
      problems.push(`HTTP ${response.status()} : ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !scenario.expectStatus) {
      problems.push(`erreur de console : ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`erreur JavaScript : ${error.message}`));

  await page.goto(base + scenario.path, { waitUntil: "networkidle" });
  if (scenario.setup) await scenario.setup(page);
  await page.waitForTimeout(250);

  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async (tags) => {
    const result = await globalThis.axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
  }, TAGS);

  for (const violation of violations) {
    problems.push(`axe ${violation.id} (${violation.impact}) : ${violation.nodes.join(" | ")}`);
  }

  const external = [...hosts].filter((host) => host !== baseHost);
  if (external.length > 0) problems.push(`requête vers un autre domaine : ${external.join(", ")}`);

  const cookies = await context.cookies();
  if (cookies.length > 0) problems.push(`cookies déposés : ${cookies.map((c) => c.name).join(", ")}`);

  if (scenario.noOverflow) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflow) problems.push("défilement horizontal (reflow WCAG 1.4.10)");
  }

  await context.close();
  return problems;
}

let failed = 0;
for (const scenario of scenarios) {
  let problems;
  try {
    problems = await run(scenario);
  } catch (error) {
    problems = [`le scénario a échoué : ${error.message.split("\n")[0]}`];
  }
  if (problems.length === 0) {
    console.log(`  OK    ${scenario.name}`);
  } else {
    failed += 1;
    console.log(`  ÉCHEC ${scenario.name}`);
    for (const problem of problems) console.log(`          - ${problem}`);
  }
}

await browser.close();
server.close();

console.log(
  failed === 0
    ? `\n${scenarios.length} scénarios réussis.`
    : `\n${failed} scénario(s) en échec sur ${scenarios.length}.`,
);
process.exit(failed === 0 ? 0 : 1);
