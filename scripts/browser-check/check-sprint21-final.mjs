// Verificação final pós-confirmação real do baseline (Sprint 21) — screenshots
// de Investimentos (cards + drilldown Série histórica) e Patrimônio, sem
// mutar nada (script só navega e fotografa).

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

function navButton(page, label) {
  return page.locator(".app-nav").getByRole("button", { name: label, exact: true });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
await page.goto(url, { waitUntil: "networkidle" });

// ---- Investimentos: cards com saldo/rendimento reais ----
await navButton(page, "Investimentos").click();
await page.locator(".dash-page").getByRole("heading", { name: "Investimentos" }).waitFor();
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "final-01-investimentos-cards.png"),
  fullPage: true,
});

// ---- Drilldown Quitar o AP: Posições + Série histórica ----
const cardQuitar = page.locator(".dash-tile", { hasText: "Quitar o AP" });
await cardQuitar.getByRole("button", { name: "Ver extrato no período" }).click();
await page.getByRole("button", { name: "Posições", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "final-02-quitar-ap-posicoes.png"),
  fullPage: true,
});

await page.getByRole("button", { name: "Série histórica" }).click();
await page
  .locator(".dash-funnel")
  .getByText("Carregando...")
  .waitFor({ state: "hidden", timeout: 10000 })
  .catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "final-03-quitar-ap-serie.png"),
  fullPage: true,
});

// ---- Patrimônio ----
await navButton(page, "Dashboards").click();
await page.locator(".dash-summary .dash-tile", { hasText: "Patrimônio" }).click();
await page
  .getByText("Saldo em investimentos")
  .waitFor({ state: "visible", timeout: 15000 })
  .catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "final-04-patrimonio.png"),
  fullPage: true,
});

await context.close();
await browser.close();
console.log("done");
