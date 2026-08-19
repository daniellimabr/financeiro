// Validação ao vivo da Sprint 22: fila de Categorização sem transação de
// investimento, botão "Excluir conta", série histórica de "Quitar o AP" sem
// pico, drilldowns de Ativos/Patrimônio. Script só navega e fotografa, não
// muta dado real (as mutações reais já foram feitas via script separado,
// aprovadas explicitamente pelo CEO).

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

const consoleErrors = [];
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
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
await page.goto(url, { waitUntil: "networkidle" });

// ---- Categorização: fila sem microtransação de investimento ----
await navButton(page, "Categorizar").click();
await page.locator(".dash-page").getByRole("heading", { name: "Categorização" }).waitFor();
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s22-01-categorizacao-fila.png"),
  fullPage: true,
});

// ---- Configurações > Gestão de Contas: botão "Excluir conta" ----
await navButton(page, "Configurações").click();
await page.getByRole("heading", { name: "Gestão de Contas" }).first().waitFor();
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s22-02-gestao-contas.png"),
  fullPage: true,
});

// ---- Investimentos: série histórica de "Quitar o AP" sem pico ----
await navButton(page, "Investimentos").click();
await page.locator(".dash-page").getByRole("heading", { name: "Investimentos" }).waitFor();
await page.waitForTimeout(500);
const cardQuitar = page.locator(".dash-tile", { hasText: "Quitar o AP" });
await cardQuitar.getByRole("button", { name: "Ver extrato no período" }).click();
await page.getByRole("button", { name: "Série histórica" }).click();
await page
  .locator(".dash-funnel")
  .getByText("Carregando...")
  .waitFor({ state: "hidden", timeout: 10000 })
  .catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s22-03-quitar-ap-serie.png"),
  fullPage: true,
});

// ---- Dashboards: drilldown Ativos com novas seções ----
await navButton(page, "Dashboards").click();
await page.locator(".dash-summary .dash-tile", { hasText: "Ativos" }).click();
await page
  .getByText("Valor atual por Investimento")
  .waitFor({ state: "visible", timeout: 15000 })
  .catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s22-04-ativos-drilldown.png"),
  fullPage: true,
});
await page.locator(".dash-summary .dash-tile", { hasText: "Ativos" }).click();

// ---- Dashboards: drilldown Patrimônio > Ver detalhe (Ativos/Passivos/Investimentos) ----
await page.locator(".dash-summary .dash-tile", { hasText: "Patrimônio" }).click();
await page
  .getByText("Saldo em investimentos")
  .waitFor({ state: "visible", timeout: 15000 })
  .catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s22-05-patrimonio-panel.png"),
  fullPage: true,
});

await page.getByRole("button", { name: "Ver detalhe" }).first().click();
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s22-06-patrimonio-ativos-valor-atual.png"),
  fullPage: true,
});
// "Fechar" fecha o funil inteiro (não só volta pro painel de Patrimônio) —
// precisa reabrir Patrimônio pra chegar no botão "Ver detalhe" seguinte.
await page.locator(".dash-back").click();
await page.locator(".dash-summary .dash-tile", { hasText: "Patrimônio" }).click();
await page
  .getByText("Saldo em investimentos")
  .waitFor({ state: "visible", timeout: 15000 })
  .catch(() => {});

await page.getByRole("button", { name: "Ver detalhe" }).nth(3).click();
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s22-07-patrimonio-investimentos-valor-atual.png"),
  fullPage: true,
});

await context.close();
await browser.close();

if (consoleErrors.length > 0) {
  console.error("Erros de console encontrados:");
  for (const e of consoleErrors) console.error(" -", e);
  process.exit(1);
}
console.log("done, sem erros de console");
