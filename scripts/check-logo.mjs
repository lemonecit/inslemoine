// Contrôle visuel du logo et du pied de page, et du retour en haut par le logo.
import { createServer } from "node:http";
import handler from "serve-handler";
import { chromium } from "playwright-core";

const server = createServer((req, res) => handler(req, res, { public: "out" }));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: "chrome" });

for (const [name, width, height] of [["desktop", 1280, 800], ["mobile", 390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    localStorage.setItem("ila-consent", JSON.stringify({ at: Date.now(), choices: {} }));
  });
  const page = await context.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator(".brand-mark").first().screenshot({ path: `${process.env.TEMP}\\logo-${name}.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.locator(".site-footer").screenshot({ path: `${process.env.TEMP}\\footer-${name}.png` });
  await page.locator(".footer-brand").click();
  await page.waitForTimeout(3000);
  console.log(name, "scrollY après clic sur le logo du pied de page :", await page.evaluate(() => Math.round(scrollY)), page.url());
  await context.close();
}

await browser.close();
server.close();
