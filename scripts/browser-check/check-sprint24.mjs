// Validação ao vivo da Sprint 24: layout do Dashboard em 2 linhas (Ativos/
// Passivos/Patrimônio separados do fluxo do mês), disclaimers removidos,
// seta de navegação de mês em Saldo Anterior/Saldo Acumulado, paleta
// categórica de 16 cores sem colisão Empréstimos/Transferência Interna,
// memórias de cálculo de Saldo/Saldo Acumulado, accordion de Patrimônio
// in-place, accordion Investimento→Holding, lista de Passivos, cor por
// ativo no drilldown, botão "Sincronizar contas" em Categorização. Script
// só navega e fotografa, não muta dado real.

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

function accordionRow(page, name) {
  return page.locator(".dash-row", { hasText: name }).first();
}

const consoleErrors = [];
const failures = [];

async function runSteps(page, label) {
  await page.goto(url, { waitUntil: "networkidle" });

  // ---- Dashboards: layout em 2 linhas, sem disclaimers, setas ----
  await navButton(page, "Dashboards").click();
  await page.locator(".dash-summary").first().waitFor();
  await page.waitForTimeout(500);

  const linhas = page.locator(".dash-summary");
  const linha1Texto = await linhas.nth(0).innerText();
  if (
    !/Ativos/.test(linha1Texto) ||
    !/Passivos/.test(linha1Texto) ||
    !/Patrimônio/.test(linha1Texto) ||
    /Receita/.test(linha1Texto)
  ) {
    failures.push(
      `[${label}] 1a linha do dash-summary não é Ativos/Passivos/Patrimônio isolados: "${linha1Texto}"`
    );
  }

  const pageText = await page.locator(".dash-page").innerText();
  if (pageText.includes("projeção por competência — pode diferir do saldo bancário")) {
    failures.push(`[${label}] disclaimer do card Saldo Acumulado ainda visível`);
  }
  if (pageText.includes("atual, fora do filtro de período — sem histórico ainda")) {
    failures.push(`[${label}] disclaimer do card Patrimônio ainda visível`);
  }

  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-01-dashboard-layout.png`),
    fullPage: true,
  });

  // ---- Card "Saldo Anterior": seta decorativa, card inteiro clicável ----
  const saldoAnteriorCard = page.locator(".dash-tile", { hasText: "Saldo Anterior" });
  const temSvgSeta = (await saldoAnteriorCard.locator("svg").count()) > 0;
  if (!temSvgSeta) {
    failures.push(`[${label}] card "Saldo Anterior" sem ícone de seta`);
  }

  // ---- Card "Saldo Acumulado": seta pro mês seguinte + drilldown com memória de cálculo ----
  const setaSeguinte = page.getByRole("button", { name: "Ver mês seguinte" });
  const setaVisivel = await setaSeguinte.isVisible().catch(() => false);
  if (!setaVisivel) {
    failures.push(`[${label}] botão "Ver mês seguinte" não encontrado no card Saldo Acumulado`);
  }

  await page.getByText("Saldo Acumulado", { exact: true }).click();
  await page.getByRole("heading", { name: "Saldo Acumulado" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const funilSaldoAcumulado = await page.locator(".dash-funnel").innerText();
  if (!funilSaldoAcumulado.includes("âncora")) {
    failures.push(`[${label}] drilldown de Saldo Acumulado sem memória de cálculo (âncora)`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-02-saldo-acumulado-memoria.png`),
    fullPage: true,
  });
  await page.locator(".dash-back").click();

  // ---- Card "Saldo": memória de cálculo, não lista de contas ----
  await page.locator(".dash-tile", { hasText: "Saldo" }).first().click();
  await page.waitForTimeout(500);
  const funilSaldo = await page.locator(".dash-funnel").innerText();
  if (!/Receita.*Despesa.*Saldo/s.test(funilSaldo)) {
    failures.push(`[${label}] card Saldo não mostra a memória de cálculo esperada`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-03-saldo-memoria.png`),
    fullPage: true,
  });
  await page.locator(".dash-back").click();

  // ---- Card "Ativos": accordion Investimento→Holding + Passivos com lista ----
  await page.locator(".dash-summary .dash-tile", { hasText: "Ativos" }).first().click();
  await page.getByText("Valor atual por Investimento").waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  await accordionRow(page, "Reserva de emergência").click().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-04-ativos-investimento-holding.png`),
    fullPage: true,
  });
  await page.locator(".dash-summary .dash-tile", { hasText: "Ativos" }).first().click();

  await page.locator(".dash-summary .dash-tile", { hasText: "Passivos" }).first().click();
  const temListaPassivos = await page
    .getByText("Passivos — saldo devedor")
    .isVisible()
    .catch(() => false);
  if (!temListaPassivos) {
    failures.push(`[${label}] card Passivos sem a lista "Passivos — saldo devedor"`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-05-passivos-lista.png`),
    fullPage: true,
  });
  await page.locator(".dash-summary .dash-tile", { hasText: "Passivos" }).first().click();

  // ---- Card "Patrimônio": accordion de 4 partes in-place, sem "Ver detalhe" ----
  await page.locator(".dash-summary .dash-tile", { hasText: "Patrimônio" }).first().click();
  await page.waitForTimeout(500);
  const temVerDetalhe = await page
    .getByRole("button", { name: "Ver detalhe" })
    .isVisible()
    .catch(() => false);
  if (temVerDetalhe) {
    failures.push(`[${label}] Patrimônio ainda mostra botão "Ver detalhe" (deveria ser accordion)`);
  }
  await accordionRow(page, "Ativos").click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-06-patrimonio-accordion.png`),
    fullPage: true,
  });
  await page.locator(".dash-back").click();

  // ---- Funil de Despesas: paleta de 16 cores, Empréstimos x Transferência Interna ----
  await page.locator(".dash-summary .dash-tile", { hasText: "Despesa" }).first().click();
  await page.waitForTimeout(500);
  const emprestimosRow = accordionRow(page, "Empréstimos");
  const transferenciaRow = accordionRow(page, "Transferência Interna");
  const temAmbos =
    (await emprestimosRow.isVisible().catch(() => false)) &&
    (await transferenciaRow.isVisible().catch(() => false));
  if (temAmbos) {
    const corEmprestimos = await emprestimosRow
      .locator(".fillbar")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const corTransferencia = await transferenciaRow
      .locator(".fillbar")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    if (corEmprestimos === corTransferencia) {
      failures.push(
        `[${label}] Empréstimos e Transferência Interna ainda com a mesma cor (${corEmprestimos})`
      );
    }
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-07-despesas-paleta.png`),
    fullPage: true,
  });
  await page.locator(".dash-summary .dash-tile", { hasText: "Despesa" }).first().click();

  // ---- Categorização: botão "Sincronizar contas", sem diálogo ----
  await navButton(page, "Categorizar").click();
  await page.getByRole("heading", { name: "Categorização" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const syncButton = page.getByRole("button", { name: "Sincronizar contas" });
  const temBotaoSync = await syncButton.isVisible().catch(() => false);
  if (!temBotaoSync) {
    failures.push(`[${label}] botão "Sincronizar contas" não encontrado em Categorização`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s24-08-categorizacao-sync.png`),
    fullPage: true,
  });
}

async function run(browser, viewport, colorScheme, label) {
  const context = await browser.newContext({ viewport, colorScheme });
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

  try {
    await runSteps(page, label);
  } catch (err) {
    failures.push(`[${label}] script falhou: ${err.message}`);
    try {
      await page.screenshot({ path: path.join(shotsDir, `${label}-s24-ERRO.png`), fullPage: true });
    } catch {
      // se nem o screenshot de erro funcionar, segue só com a mensagem já registrada.
    }
  }

  await context.close();
  console.log(`[${label}] done`);
}

const browser = await chromium.launch();
try {
  await run(browser, { width: 1440, height: 1000 }, "light", "desktop-claro");
  await run(browser, { width: 1440, height: 1000 }, "dark", "desktop-escuro");
  await run(browser, { width: 390, height: 844 }, "light", "mobile-claro");
  await run(browser, { width: 390, height: 844 }, "dark", "mobile-escuro");
} finally {
  await browser.close();
}

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
