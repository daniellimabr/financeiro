// QA visual da Sprint 16 — toggle Competência/Caixa no Dashboard/Ativos/
// Passivos, novo breakdown de Patrimônio (Saldo líquido acumulado + Saldo em
// investimentos, em vez de Saldo em conta/Saldo de cartão), e conferência de
// que o toggle muda os números exibidos. Roda contra dado real da conta do
// CEO na VM de dev — script é somente leitura (nenhuma mutação de dado
// persistido, diferente da Sprint 15), então não há nada pra reverter.
// Logout é sempre o último passo (invalida a sessão do próprio script).

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

function navButton(page, label) {
  return page.locator(".app-nav").getByRole("button", { name: label, exact: true });
}

async function cardValue(page, label) {
  const tile = page.locator(".dash-summary .dash-tile", { hasText: label });
  return (await tile.locator(".v").innerText()).trim();
}

function regimeToggle(page) {
  return page.getByRole("group", { name: "Regime" });
}

async function runSteps(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });

  // ---- 1. Dashboard: toggle Competência/Caixa presente e Competência ativo por default ----
  await page.locator(".dash-summary").waitFor({ state: "visible", timeout: 10000 });
  const toggle = regimeToggle(page);
  await toggle.waitFor({ state: "visible" });
  const competenciaBtn = toggle.getByRole("button", { name: "Competência" });
  const caixaBtn = toggle.getByRole("button", { name: "Caixa" });
  if ((await competenciaBtn.getAttribute("aria-pressed")) !== "true") {
    consoleErrors.push(`[${label}] toggle Regime não começa em Competência`);
  }
  const despesaCompetencia = await cardValue(page, "Despesa");
  const patrimonioCompetencia = await cardValue(page, "Patrimônio");
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-01-dashboard-competencia.png`),
    fullPage: true,
  });

  // ---- 2. Alterna pra Caixa — cards recarregam consistentemente ----
  await caixaBtn.click();
  await page.waitForTimeout(600);
  if ((await caixaBtn.getAttribute("aria-pressed")) !== "true") {
    consoleErrors.push(`[${label}] clicar Caixa não marcou aria-pressed`);
  }
  const despesaCaixa = await cardValue(page, "Despesa");
  const patrimonioCaixa = await cardValue(page, "Patrimônio");
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-02-dashboard-caixa.png`),
    fullPage: true,
  });
  // Não exige que os valores mudem (pode não haver cartão de crédito com
  // competência deslocada no período filtrado) — só registra pra
  // conferência manual do CEO, critério real é "recarrega sem erro".
  console.log(
    `[${label}] Despesa competencia=${despesaCompetencia} caixa=${despesaCaixa}; ` +
      `Patrimonio competencia=${patrimonioCompetencia} caixa=${patrimonioCaixa}`
  );

  // ---- 3. Drill-down Patrimônio: 4 linhas com os nomes novos ----
  await page.locator(".dash-summary .dash-tile", { hasText: "Patrimônio" }).click();
  await page.getByRole("heading", { name: "Patrimônio" }).waitFor({ state: "visible" });
  await page.getByText("Saldo líquido acumulado").waitFor({ state: "visible", timeout: 5000 });
  await page.getByText("Saldo em investimentos").waitFor({ state: "visible", timeout: 5000 });
  const temCamposAntigos =
    (await page.getByText("Saldo em conta").count()) > 0 ||
    (await page.getByText("Saldo de cartão de crédito").count()) > 0;
  if (temCamposAntigos) {
    consoleErrors.push(`[${label}] breakdown de Patrimônio ainda mostra rótulos antigos`);
  }
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-03-patrimonio-breakdown.png`),
    fullPage: true,
  });

  // "Ver detalhe" de Saldo líquido acumulado deve abrir o drill-down de Saldo Acumulado.
  await page
    .locator("tr", { hasText: "Saldo líquido acumulado" })
    .getByRole("button", { name: "Ver detalhe" })
    .click();
  await page.getByRole("heading", { name: "Saldo Acumulado" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-04-saldo-acumulado-via-patrimonio.png`),
    fullPage: true,
  });

  // ---- 4. Drill-down Despesa (Categoria) respeita o toggle em Caixa ----
  await navButton(page, "Dashboards").click();
  await page.locator(".dash-summary").waitFor({ state: "visible" });
  await regimeToggle(page).getByRole("button", { name: "Caixa" }).click();
  await page.waitForTimeout(400);
  await page.locator(".dash-summary .dash-tile", { hasText: /^Despesa/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-05-despesa-drilldown-caixa.png`),
    fullPage: true,
  });

  // ---- 5. Ativos: toggle Competência/Caixa presente, ao lado do toggle
  // Despesa/Receita já existente (pré-Sprint 16, AssetsPage.tsx) ----
  await navButton(page, "Ativos").click();
  await page.locator(".dash-summary").waitFor({ state: "visible", timeout: 10000 });
  await regimeToggle(page).waitFor({ state: "visible" });
  const temToggleDespesaReceita =
    (await page.getByRole("group", { name: "Tipo de transação" }).count()) > 0;
  if (!temToggleDespesaReceita) {
    consoleErrors.push(`[${label}] Ativos perdeu o toggle "Tipo de transação" pré-existente`);
  }
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-06-ativos-regime-toggle.png`),
    fullPage: true,
  });

  // ---- 6. Passivos: toggle Competência/Caixa presente ----
  await navButton(page, "Passivos").click();
  await page.locator(".dash-summary, .dash-empty").first().waitFor({ state: "visible" });
  await regimeToggle(page).waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-07-passivos-regime-toggle.png`),
    fullPage: true,
  });

  // ---- 7. Logout (sempre por último — invalida a sessão) ----
  await navButton(page, "Configurações").click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.getByRole("link", { name: "Entrar com Google" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint16-08-logout.png`),
    fullPage: true,
  });
}

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

  try {
    await runSteps(page, label);
  } catch (err) {
    consoleErrors.push(`[${label}] script falhou: ${err.message}`);
    try {
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint16-ERRO.png`),
        fullPage: true,
      });
    } catch {
      // se nem o screenshot de erro funcionar, segue só com a mensagem já registrada.
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
