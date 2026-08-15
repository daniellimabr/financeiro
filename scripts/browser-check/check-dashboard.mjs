// Inspeção autenticada específica: login-hero -> shell -> aba Dashboards ->
// funil de drill-down. Usa um token de sessão real gerado via
// app.auth.jwt.create_access_token no próprio container da API (mesmo
// mecanismo de uma sessão real pós-login Google), passado por variável de
// ambiente para não aparecer em nenhum log de comando.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(__dirname, "shots");
mkdirSync(shotsDir, { recursive: true });

const url = process.argv[2] || "http://financeirov2.duckdns.org:8080/";
const token = process.env.FINANCEIRO_SESSION_TOKEN;
if (!token) {
  console.error("defina FINANCEIRO_SESSION_TOKEN no ambiente");
  process.exit(1);
}

const consoleErrors = [];

async function run(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const u = new URL(url);
  await context.addCookies([
    {
      name: "financeiro_session",
      value: token,
      domain: u.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotsDir, `${label}-01-inicio.png`), fullPage: true });

  await page.getByRole("button", { name: "Dashboards" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shotsDir, `${label}-02-dashboards.png`), fullPage: true });

  const despesaTile = page.getByRole("button", { name: /Despesa/ }).first();
  if (await despesaTile.count()) {
    await despesaTile.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-03-drilldown.png`),
      fullPage: true,
    });
  }

  await context.close();
  console.log(`[${label}] done`);
}

const browser = await chromium.launch();
try {
  await run(browser, { width: 1440, height: 900 }, "desktop");
  await run(browser, { width: 390, height: 844 }, "mobile");
} finally {
  await browser.close();
}

console.log(consoleErrors.length ? consoleErrors.join("\n") : "no console errors");
