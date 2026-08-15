// Ferramenta de QA visual do CTO — navega, tira screenshot e reporta erros
// de console contra uma instância real do app. Uso:
//
//   node check.mjs <url> [--cookie NOME=VALOR] [--out prefixo] [--mobile]
//
// Screenshots salvos em scripts/browser-check/shots/<prefixo>-{desktop,mobile}.png

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(__dirname, "shots");
mkdirSync(shotsDir, { recursive: true });

const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error("uso: node check.mjs <url> [--cookie NOME=VALOR] [--out prefixo] [--mobile]");
  process.exit(1);
}

const cookieArgIndex = args.indexOf("--cookie");
const cookieArg = cookieArgIndex >= 0 ? args[cookieArgIndex + 1] : null;
const outArgIndex = args.indexOf("--out");
const prefix = outArgIndex >= 0 ? args[outArgIndex + 1] : "shot";
const alsoMobile = args.includes("--mobile");

const consoleErrors = [];

async function shootViewport(browser, { width, height }, label, cookie) {
  const context = await browser.newContext({ viewport: { width, height } });
  if (cookie) {
    const [name, value] = cookie.split("=");
    const u = new URL(url);
    await context.addCookies([
      { name, value, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
  }
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const shotPath = path.join(shotsDir, `${prefix}-${label}.png`);
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log(`screenshot: ${shotPath}`);

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log(`[${label}] title: ${title}`);
  console.log(`[${label}] body preview: ${bodyText.replace(/\n+/g, " | ")}`);

  await context.close();
}

const browser = await chromium.launch();
try {
  await shootViewport(browser, { width: 1440, height: 900 }, "desktop", cookieArg);
  if (alsoMobile) {
    await shootViewport(browser, { width: 390, height: 844 }, "mobile", cookieArg);
  }
} finally {
  await browser.close();
}

if (consoleErrors.length > 0) {
  console.log("\nconsole errors:");
  for (const e of consoleErrors) console.log(" -", e);
} else {
  console.log("\nno console errors");
}
