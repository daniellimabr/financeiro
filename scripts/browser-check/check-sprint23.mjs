// Validação ao vivo da Sprint 23: card de Investimento sem tags soltas de
// Carteiras/Posições, abrindo direto na view "Posições"; aba "Extrato" de
// "Quitar o AP" (investimento só-holdings) mostrando movimento real via
// extrato unificado. Script só navega e fotografa, não muta dado real.

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
const failures = [];
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

// ---- Investimentos: card sem tags soltas de Carteiras/Posições ----
await navButton(page, "Investimentos").click();
await page.locator(".dash-page").getByRole("heading", { name: "Investimentos" }).waitFor();
await page.waitForTimeout(500);

const cardCount = await page.locator(".dash-tile").count();
for (let i = 0; i < cardCount; i++) {
  const cardText = await page.locator(".dash-tile").nth(i).innerText();
  if (cardText.includes("Carteiras:") || cardText.includes("Posições:")) {
    failures.push(`Card ${i} ainda mostra tag solta de Carteiras/Posições: ${cardText}`);
  }
}
await page.screenshot({ path: path.join(shotsDir, "s23-01-investimentos-cards.png"), fullPage: true });

// ---- Card "Quitar o AP": abre direto em "Posições" ----
const cardQuitar = page.locator(".dash-tile", { hasText: "Quitar o AP" });
await cardQuitar.getByRole("button", { name: "Ver posições" }).click();
const posicoesToggle = page
  .locator(".dash-toggle", { hasText: "Posições" })
  .getByRole("button", { name: "Posições", exact: true });
const isPosicoesDefault = (await posicoesToggle.getAttribute("aria-pressed")) === "true";
if (!isPosicoesDefault) {
  failures.push('Drilldown não abriu com "Posições" como view default.');
}
await page
  .locator(".dash-funnel")
  .getByText("Carregando...")
  .waitFor({ state: "hidden", timeout: 10000 })
  .catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s23-02-quitar-ap-posicoes-default.png"),
  fullPage: true,
});

// ---- Aba "Extrato": mês corrente (ago/2026) não tem movimento real do
// Bloco 0 (intervalo real é out/2025-abr/2026) — vazio aqui é esperado,
// não regressão. Screenshot só de referência.
await page.getByRole("button", { name: "Extrato" }).click();
await page
  .locator(".dash-funnel")
  .getByText("Carregando...")
  .waitFor({ state: "hidden", timeout: 10000 })
  .catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({
  path: path.join(shotsDir, "s23-03-quitar-ap-extrato-mes-atual.png"),
  fullPage: true,
});

// Abril/2026 tem movimento real confirmado no Bloco 0 (2 transações de
// holding em 2026-04-30) — é o caso que reproduz o bug original (extrato
// sempre vazio pra investimento só-holdings).
await page.getByRole("combobox", { name: "Mês" }).selectOption("4");
await page
  .locator(".dash-funnel")
  .getByText("Carregando...")
  .waitFor({ state: "hidden", timeout: 10000 })
  .catch(() => {});
await page.waitForTimeout(500);

const extratoVazio = await page
  .getByText("Nenhuma transação vinculada neste período.")
  .isVisible()
  .catch(() => false);
const temTabela = await page
  .locator(".extrato-unificado-table")
  .isVisible()
  .catch(() => false);
if (extratoVazio || !temTabela) {
  failures.push(
    `Extrato de "Quitar o AP" em abril/2026 ainda vazio (esperado: 2 transações de holding do Bloco 0). vazio=${extratoVazio} tabela=${temTabela}`
  );
}
await page.screenshot({
  path: path.join(shotsDir, "s23-04-quitar-ap-extrato-abril-2026.png"),
  fullPage: true,
});

await context.close();
await browser.close();

if (failures.length > 0) {
  console.error("Falhas encontradas:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
if (consoleErrors.length > 0) {
  console.error("Erros de console encontrados:");
  for (const e of consoleErrors) console.error(" -", e);
  process.exit(1);
}
console.log("done, sem erros de console, sem falhas de asserção");
