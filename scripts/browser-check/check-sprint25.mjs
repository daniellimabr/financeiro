// Validação ao vivo da Sprint 25: escala visual (~80%), tela Ativos sem toggle
// Competência/Caixa com accordion Categoria→Subcategoria→Transação no drilldown
// por ativo, card Ativos reordenado (Valor atual por Ativo → Valor atual por
// Investimento com cor por item → Despesas por Ativo, sem Saldo por conta),
// card Passivos com lista barra+%, percentual do total em todo drilldown de
// valor atual, disclaimer do Patrimônio ausente, fórmula do Saldo Acumulado
// visível. Script só navega e fotografa, não muta dado real.

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

function tile(page, name) {
  return page.locator(".dash-summary .dash-tile", { hasText: name }).first();
}

const consoleErrors = [];
const failures = [];

async function runSteps(page, label) {
  await page.goto(url, { waitUntil: "networkidle" });

  // ---- Escala visual: --text-base deve refletir a redução de ~20% (16px -> 13px) ----
  const textBase = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--text-base").trim()
  );
  if (textBase !== "13px") {
    failures.push(`[${label}] --text-base não é 13px (achado: "${textBase}")`);
  }

  await page.screenshot({
    path: path.join(shotsDir, `${label}-s25-01-escala-visual.png`),
    fullPage: true,
  });

  // ---- Tela Ativos: sem toggle Competência/Caixa, drilldown vira accordion ----
  await navButton(page, "Ativos").click();
  await page.getByRole("heading", { name: "Ativos", level: 2 }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);

  const temToggleRegime =
    (await page.getByRole("button", { name: "Competência", exact: true }).isVisible().catch(() => false)) ||
    (await page.getByRole("button", { name: "Caixa", exact: true }).isVisible().catch(() => false));
  if (temToggleRegime) {
    failures.push(`[${label}] tela Ativos ainda mostra o toggle Competência/Caixa`);
  }

  const gastoButton = page.getByRole("button", { name: "Ver gasto no período" }).first();
  if (await gastoButton.isVisible().catch(() => false)) {
    await gastoButton.click();
    await page.waitForTimeout(500);
    const funilAtivo = page.locator(".dash-funnel");
    const temTabelaPlana = (await funilAtivo.locator("table.txn-table").count()) > 0;
    if (temTabelaPlana) {
      failures.push(`[${label}] drilldown por ativo ainda é tabela plana, não accordion`);
    }
    const temAccordion = (await funilAtivo.locator(".dash-accordion").count()) > 0;
    if (!temAccordion) {
      failures.push(`[${label}] drilldown por ativo sem accordion Categoria→Subcategoria`);
    }
    await page.screenshot({
      path: path.join(shotsDir, `${label}-s25-02-ativos-drilldown-accordion.png`),
      fullPage: true,
    });
  }

  // ---- Card Ativos do Dashboard: ordem das seções + sem Saldo por conta ----
  await navButton(page, "Dashboards").click();
  await page.locator(".dash-summary").first().waitFor();
  await page.waitForTimeout(300);

  await tile(page, "Ativos").click();
  await page.getByText("Valor atual por Ativo").waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);

  const funilAtivos = page.locator(".dash-funnel");
  const titulosAtivos = await funilAtivos.locator("h3").allInnerTexts();
  const ordemEsperada = ["Valor atual por Ativo", "Valor atual por Investimento", "Despesas por Ativo"];
  const ordemOk = ordemEsperada.every((titulo, i) => titulosAtivos[i] === titulo);
  if (!ordemOk) {
    failures.push(
      `[${label}] ordem das seções do card Ativos incorreta: [${titulosAtivos.join(", ")}]`
    );
  }
  const temSaldoPorConta = (await funilAtivos.getByText("Saldo por conta").count()) > 0;
  if (temSaldoPorConta) {
    failures.push(`[${label}] card Ativos ainda mostra "Saldo por conta"`);
  }
  // percentual do total na lista "Valor atual por Ativo" (tabela)
  const temPercentualAtivos = (await funilAtivos.locator(".pct-col").count()) > 0;
  if (!temPercentualAtivos) {
    failures.push(`[${label}] "Valor atual por Ativo" sem coluna de percentual`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s25-03-card-ativos-ordem.png`),
    fullPage: true,
  });
  await tile(page, "Ativos").click();

  // ---- Card Passivos: lista barra+%, sem tabela, sem expandir ----
  await tile(page, "Passivos").click();
  await page.getByText("Passivos — saldo devedor").waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  const funilPassivos = page.locator(".dash-funnel");
  const passivosRow = funilPassivos.locator(".dash-row").last();
  const temPct = (await passivosRow.locator(".pct").count()) > 0;
  const temTabelaPassivos = (await funilPassivos.locator("table").count()) > 0;
  if (!temPct) {
    failures.push(`[${label}] "Passivos — saldo devedor" sem percentual (%) na linha`);
  }
  if (temTabelaPassivos) {
    failures.push(`[${label}] "Passivos — saldo devedor" ainda usa tabela, não dash-row`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s25-04-card-passivos-barra.png`),
    fullPage: true,
  });
  await tile(page, "Passivos").click();

  // ---- Card Patrimônio: disclaimer ausente (validação, sem código novo esperado) ----
  const pageText = (await page.locator(".dash-page").innerText()).toLowerCase();
  if (pageText.includes("atual, fora do filtro de período — sem histórico ainda")) {
    failures.push(`[${label}] disclaimer do card Patrimônio ainda visível`);
  }

  // ---- Card Saldo Acumulado: fórmula visível no início do drilldown ----
  await page.getByRole("button", { name: /^Saldo Acumulado/ }).click();
  await page.getByRole("heading", { name: "Saldo Acumulado" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  const funilSaldoAcumulado = await page.locator(".dash-funnel").innerText();
  if (!funilSaldoAcumulado.includes("Saldo do mês anterior + Receita do mês")) {
    failures.push(`[${label}] fórmula do Saldo Acumulado não está visível no drilldown`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s25-05-saldo-acumulado-formula.png`),
    fullPage: true,
  });
  await page.locator(".dash-back").click();
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
      await page.screenshot({ path: path.join(shotsDir, `${label}-s25-ERRO.png`), fullPage: true });
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
