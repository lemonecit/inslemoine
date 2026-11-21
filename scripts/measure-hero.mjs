// Mesure du hero à plusieurs largeurs de téléphone, dans des contextes de navigateur propres.
import { createServer } from "node:http";
import handler from "serve-handler";
import { chromium } from "playwright-core";

const server = createServer((req, res) => handler(req, res, { public: "out" }));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome" });

for (const width of [320, 360, 390, 412, 600, 768]) {
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  await context.addInitScript(() => {
    localStorage.setItem("ila-consent", JSON.stringify({ at: Date.now(), choices: {} }));
  });
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    const h1 = document.querySelector(".hero h1");
    const lines = Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight));
    const range = document.createRange();
    range.selectNodeContents(h1);
    const widest = Math.max(...[...range.getClientRects()].map((rect) => rect.width));
    const box = document.querySelector(".hero-inner").getBoundingClientRect();
    const hero = document.querySelector(".hero").getBoundingClientRect();
    const actions = document.querySelector(".hero-actions").getBoundingClientRect();
    const visible = (el) => getComputedStyle(el).display !== "none";
    return {
      h1Px: Math.round(parseFloat(getComputedStyle(h1).fontSize)),
      h1Lines: lines,
      widestLine: Math.round(widest),
      room: Math.round(box.width),
      fits: widest <= box.width + 1,
      heroH: Math.round(hero.height),
      actionsBottomPct: Math.round(((actions.bottom - hero.top) / hero.height) * 100),
      art: visible(document.querySelector(".hero-art-tall")) ? "tall" : "wide",
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  console.log(String(width).padEnd(4), JSON.stringify(r));
  await context.close();
}

await browser.close();
server.close();
