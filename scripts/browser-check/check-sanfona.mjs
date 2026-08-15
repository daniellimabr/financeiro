// QA visual específico da Sprint 6 — sparkline nos cards, sanfona multi-nível
// (categoria + meio de pagamento expandidos ao mesmo tempo, sem esconder o
// nível anterior) e tipografia Archivo/Public Sans, contra dado real da VM
// de dev. Mesmo mecanismo de sessão de check-dashboard.mjs.

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
  await page.getByRole("button", { name: "Dashboards" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sanfona-01-cards.png`),
    fullPage: true,
  });

  const despesaTile = page.getByRole("button", { name: /Despesa/ }).first();
  await despesaTile.click();
  await page.waitForTimeout(500);

  const primeiraCategoria = page.locator(".dash-accordion > li .dash-row").first();
  if (await primeiraCategoria.count()) {
    await primeiraCategoria.click();
    await page.waitForTimeout(500);

    const segundaCategoria = page.locator(".dash-accordion > li .dash-row").nth(1);
    if (await segundaCategoria.count()) {
      await segundaCategoria.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: path.join(shotsDir, `${label}-sanfona-02-categorias-expandidas.png`),
      fullPage: true,
    });

    const primeiroMeio = page
      .locator(".dash-accordion-panel .dash-accordion > li .dash-row")
      .first();
    if (await primeiroMeio.count()) {
      await primeiroMeio.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sanfona-03-extrato.png`),
        fullPage: true,
      });
    }
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
