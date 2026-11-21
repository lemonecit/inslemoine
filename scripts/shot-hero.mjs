// Skärmdump av hero à 390 px (mobil) et 1280 px (ordinateur), dans des contextes propres.
import { createServer } from "node:http";
import handler from "serve-handler";
import { chromium } from "playwright-core";

const server = createServer((req, res) => handler(req, res, { public: "out" }));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome" });

for (const [name, width, height] of [["mobile", 390, 844], ["desktop", 1280, 800]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    localStorage.setItem("ila-consent", JSON.stringify({ at: Date.now(), choices: {} }));
  });
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${process.env.TEMP}\\hero-${name}.png` });
  await context.close();
}

await browser.close();
server.close();
