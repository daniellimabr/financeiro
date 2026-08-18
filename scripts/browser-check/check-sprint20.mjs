// QA visual da Sprint 20 — Investments completos da Pluggy: lista "Posições de
// investimento" em Gestão de Contas (vínculo + saldo inicial), card do
// investimento listando posições vinculadas, view "Posições" no drilldown de
// InvestimentosPage com histórico expansível por posição. Roda contra dado
// real da conta do CEO na VM de dev, já sincronizado nesta sessão (22
// holdings: 18 CDBs/Tesouro da Nubank Investimentos + 4 ações da XP).
// Script cria 1 Investimento de teste e vincula 1 posição real (TAEE11, XP) —
// ambos revertidos ao final (desvincula + exclui o Investimento). Logout é
// sempre o último passo (invalida a sessão do próprio script).

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

const TEST_INVESTIMENTO_NOME = "QA Sprint 20 (temporario)";
const POSICAO_LABEL = "TAEE11";

const consoleErrors = [];

function navButton(page, label) {
  return page
    .locator(".app-nav")
    .getByRole("button", { name: label, exact: true });
}

async function runSteps(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error")
      consoleErrors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on("pageerror", (err) =>
    consoleErrors.push(`[${label}] pageerror: ${err.message}`),
  );

  await page.goto(url, { waitUntil: "networkidle" });

  // ---- 1. Gestão de contas: lista "Posições de investimento" com dado real ----
  await navButton(page, "Configurações").click();
  await page
    .getByRole("heading", { name: "Posições de investimento" })
    .waitFor({
      state: "visible",
      timeout: 10000,
    });
  const posicaoItem = page.locator(".simple-list li", {
    hasText: POSICAO_LABEL,
  });
  await posicaoItem.waitFor({ state: "visible", timeout: 10000 });
  const temEquity = (await posicaoItem.getByText("EQUITY / STOCK").count()) > 0;
  if (!temEquity) {
    consoleErrors.push(
      `[${label}] posição ${POSICAO_LABEL} não mostra tipo/subtipo esperado`,
    );
  }
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-01-posicoes-lista.png`),
    fullPage: true,
  });

  // ---- 2. Cria Investimento de teste (via InvestimentosPage) ----
  await navButton(page, "Investimentos").click();
  await page
    .locator(".dash-page")
    .getByRole("heading", { name: "Investimentos" })
    .waitFor({
      state: "visible",
    });
  await page.getByRole("button", { name: "Novo investimento" }).click();
  await page.getByLabel("Nome").fill(TEST_INVESTIMENTO_NOME);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar" })
    .click();
  await page
    .getByText(TEST_INVESTIMENTO_NOME)
    .waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(300);

  // ---- 3. Vincula a posição real ao Investimento de teste (Gestão de contas) ----
  await navButton(page, "Configurações").click();
  await page
    .getByRole("heading", { name: "Posições de investimento" })
    .waitFor({
      state: "visible",
    });
  const select = posicaoItem.getByLabel(`Investimento de ${POSICAO_LABEL}`);
  await select.waitFor({ state: "visible", timeout: 10000 });
  await select.selectOption({ label: TEST_INVESTIMENTO_NOME });
  await page.waitForTimeout(1500);
  const selectedLabel = await select.locator("option:checked").innerText();
  if (selectedLabel !== TEST_INVESTIMENTO_NOME) {
    consoleErrors.push(
      `[${label}] vínculo de posição não persistiu (select mostra "${selectedLabel}")`,
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-02-posicao-vinculada.png`),
    fullPage: true,
  });

  // ---- 4. Card do investimento lista a posição vinculada ----
  await navButton(page, "Investimentos").click();
  const card = page.locator(".dash-tile", { hasText: TEST_INVESTIMENTO_NOME });
  await card.waitFor({ state: "visible", timeout: 10000 });
  const temTagPosicao =
    (await card.getByText(`Posições: ${POSICAO_LABEL}`).count()) > 0;
  if (!temTagPosicao) {
    consoleErrors.push(
      `[${label}] card do investimento não lista a posição vinculada`,
    );
  }
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-03-card-com-posicao.png`),
    fullPage: true,
  });

  // ---- 5. Drilldown: view "Posições" mostra a posição e expande histórico ----
  await card.getByRole("button", { name: "Ver extrato no período" }).click();
  await page.getByRole("button", { name: "Posições", exact: true }).click();
  const posicaoRow = page.locator(".dash-table tbody tr", {
    hasText: POSICAO_LABEL,
  });
  await posicaoRow.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-04-drilldown-posicoes.png`),
    fullPage: true,
  });

  await posicaoRow.getByRole("button", { name: "Ver histórico" }).click();
  await page.waitForTimeout(500);
  const historicoVazio =
    (await page.getByText("Nenhuma transação no histórico").count()) > 0;
  const historicoComLinhas =
    (await page.locator(".dash-table tbody tr td").count()) > 0;
  if (!historicoVazio && !historicoComLinhas) {
    consoleErrors.push(
      `[${label}] expandir histórico da posição não renderizou nada`,
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-05-historico-posicao.png`),
    fullPage: true,
  });

  // ---- 6. Reverte: desvincula a posição e exclui o Investimento de teste ----
  await navButton(page, "Configurações").click();
  await page
    .getByRole("heading", { name: "Posições de investimento" })
    .waitFor({
      state: "visible",
    });
  await posicaoItem
    .getByLabel(`Investimento de ${POSICAO_LABEL}`)
    .selectOption({ label: "Nenhum" });
  await page.waitForTimeout(500);

  await navButton(page, "Investimentos").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".dash-tile", { hasText: TEST_INVESTIMENTO_NOME })
    .getByRole("button", { name: "Excluir" })
    .click();
  await page
    .getByText(TEST_INVESTIMENTO_NOME)
    .waitFor({ state: "hidden", timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-06-revertido.png`),
    fullPage: true,
  });

  // ---- 7. Patrimônio: saldo_investimentos aparece no breakdown, sem erro ----
  await navButton(page, "Dashboards").click();
  await page
    .locator(".dash-summary .dash-tile", { hasText: "Patrimônio" })
    .click();
  await page
    .getByText("Saldo em investimentos")
    .waitFor({ state: "visible", timeout: 5000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-07-patrimonio.png`),
    fullPage: true,
  });

  // ---- 8. Logout (sempre por último — invalida a sessão) ----
  await navButton(page, "Configurações").click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.getByRole("link", { name: "Entrar com Google" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint20-08-logout.png`),
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
        path: path.join(shotsDir, `${label}-sprint20-ERRO.png`),
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

console.log(
  consoleErrors.length ? consoleErrors.join("\n") : "no console errors",
);
