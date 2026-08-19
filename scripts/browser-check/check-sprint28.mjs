// Validação ao vivo da Sprint 28: card Ativos ganha saldo de conta corrente
// (total completo = Gestão de Ativos + Investimentos + contas correntes) e
// troca a seção "Despesas por Ativo" por "Saldo por Conta Corrente"; card
// Patrimônio é redesenhado pra 3 partes (Ativos/Passivos/Saldo Acumulado do
// Mês) — o achado central desta sprint é que "Saldo Acumulado do Mês" dentro
// de Patrimônio deve bater exatamente com o valor do card "Saldo Acumulado"
// no mesmo dia (bug relatado pelo CEO, causado por um termo extra removido
// nesta sprint). Script só navega e lê dado real, não muta nada.

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

function tileExact(page, name) {
  return page.locator(".dash-summary .dash-tile").filter({
    has: page.locator(".k", { hasText: new RegExp(`^${name}$`) }),
  });
}

function accordionRow(scope, name) {
  return scope.locator(".dash-accordion > li .dash-row").filter({
    has: scope.page().locator(".nm", { hasText: new RegExp(`^${name}$`) }),
  });
}

const consoleErrors = [];
const failures = [];

async function runSteps(page, label) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".dash-summary").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);

  // ---- Card "Saldo Acumulado" (fora de Patrimônio) — valor de referência ----
  // aria-label explícito (`Saldo Acumulado R$ ...`) em vez do texto visível
  // de `.k` — o card tem um botão de seta aninhado dentro do próprio `.k`.
  const saldoAcumuladoTile = page.locator('[aria-label^="Saldo Acumulado"]');
  await saldoAcumuladoTile.waitFor({ timeout: 10000 });
  const saldoAcumuladoCardValor = (await saldoAcumuladoTile.locator(".v").innerText()).trim();

  // ---- Card Ativos: total completo + drilldown sem "Despesas por Ativo" ----
  await tileExact(page, "Ativos").click();
  await page.getByText("Valor atual por Ativo").waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);

  const funilAtivos = page.locator(".dash-funnel");
  const headingsAtivos = await funilAtivos.getByRole("heading", { level: 3 }).allInnerTexts();
  if (headingsAtivos.join("|") !== "Valor atual por Ativo|Valor atual por Investimento|Saldo por Conta Corrente") {
    failures.push(
      `[${label}] headings do drilldown de Ativos fora do esperado: ${headingsAtivos.join(", ")}`
    );
  }
  if (headingsAtivos.includes("Despesas por Ativo")) {
    failures.push(`[${label}] "Despesas por Ativo" ainda aparece no drilldown de Ativos`);
  }
  const temToggleDespesaReceita = await page
    .getByRole("group", { name: "Tipo de transação" })
    .isVisible()
    .catch(() => false);
  if (temToggleDespesaReceita) {
    failures.push(`[${label}] toggle Despesa/Receita ainda aparece no drilldown de Ativos`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s28-01-ativos-drilldown.png`),
    fullPage: true,
  });
  await tileExact(page, "Ativos").click();

  // ---- Card Patrimônio: 3 partes, "Saldo Acumulado do Mês" bate com o card ----
  await tileExact(page, "Patrimônio").click();
  const patrimonioFunil = page.locator(".dash-funnel");
  await patrimonioFunil.locator(".patrimonio-total").waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);

  const partesRows = patrimonioFunil.locator(".dash-accordion > li .dash-row .nm");
  const partesNomes = await partesRows.allInnerTexts();
  if (partesNomes.length !== 3) {
    failures.push(
      `[${label}] accordion de Patrimônio não tem 3 partes (encontrado: ${partesNomes.join(", ")})`
    );
  }
  if (!partesNomes.includes("Saldo Acumulado do Mês")) {
    failures.push(`[${label}] parte "Saldo Acumulado do Mês" não encontrada em Patrimônio`);
  }
  if (partesNomes.some((n) => n === "Saldo líquido acumulado" || n === "Saldo em investimentos")) {
    failures.push(`[${label}] rótulo antigo ainda presente no accordion de Patrimônio`);
  }

  const saldoAcumuladoMesRow = accordionRow(patrimonioFunil, "Saldo Acumulado do Mês");
  const saldoAcumuladoMesValor = (await saldoAcumuladoMesRow.locator(".amt").innerText()).trim();
  if (saldoAcumuladoMesValor !== saldoAcumuladoCardValor) {
    failures.push(
      `[${label}] "Saldo Acumulado do Mês" (${saldoAcumuladoMesValor}) não bate com o card "Saldo Acumulado" (${saldoAcumuladoCardValor})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s28-02-patrimonio-3-partes.png`),
    fullPage: true,
  });

  // ---- Expandir "Ativos" dentro de Patrimônio mostra as 3 sub-seções ----
  await accordionRow(patrimonioFunil, "Ativos").click();
  await page.waitForTimeout(300);
  const subHeadings = await patrimonioFunil.getByRole("heading", { level: 3 }).allInnerTexts();
  const esperado = ["Gestão de Ativos", "Investimentos", "Saldo por Conta Corrente"];
  const temTodasSubsecoes = esperado.every((h) => subHeadings.includes(h));
  if (!temTodasSubsecoes) {
    failures.push(
      `[${label}] expandir Ativos em Patrimônio não mostrou as 3 sub-seções (encontrado: ${subHeadings.join(", ")})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s28-03-patrimonio-ativos-expandido.png`),
    fullPage: true,
  });
  await tileExact(page, "Patrimônio").click();
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
      await page.screenshot({ path: path.join(shotsDir, `${label}-s28-ERRO.png`), fullPage: true });
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
