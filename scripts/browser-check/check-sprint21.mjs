// QA visual da Sprint 21 — vínculo automático holdings->Investimento + série
// histórica mensal. Roda contra dado real da conta do CEO na VM de dev (22
// holdings sincronizadas na Sprint 20/21). Script é somente leitura/navegação
// — não confirma nenhuma proposta de baseline nem vincula/edita nada (essas
// mutações já foram validadas diretamente contra o banco nesta sessão de
// execução, com reversão confirmada). Logout é sempre o último passo.

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

async function runSteps(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });

  // ---- 1. Gestão de contas: seção de baseline dez/2025 abre sem erro ----
  await navButton(page, "Configurações").click();
  await page
    .getByRole("heading", { name: "Baseline de saldo em 31/12/2025" })
    .waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("button", { name: "Revisar proposta de baseline" }).click();
  const baselineTable = page.locator("table.dash-table").filter({ hasText: "Saldo proposto" });
  await baselineTable.waitFor({ state: "visible", timeout: 15000 });
  const linhasBaseline = await baselineTable.locator("tbody tr").count();
  if (linhasBaseline === 0) {
    consoleErrors.push(`[${label}] proposta de baseline renderizou sem nenhuma linha`);
  }
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint21-01-baseline-proposta.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Fechar" }).click();

  // ---- 2. Posições de investimento: select de vínculo continua funcional ----
  await page
    .getByRole("heading", { name: "Posições de investimento" })
    .waitFor({ state: "visible", timeout: 10000 });
  const algumSelect = page.locator(".simple-list select").first();
  await algumSelect.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint21-02-posicoes-investimento.png`),
    fullPage: true,
  });

  // ---- 3. Investimentos: aba "Série histórica" nova no drilldown ----
  await navButton(page, "Investimentos").click();
  await page
    .locator(".dash-page")
    .getByRole("heading", { name: "Investimentos" })
    .waitFor({ state: "visible" });
  const primeiroCard = page.locator(".dash-tile").first();
  await primeiroCard.waitFor({ state: "visible", timeout: 10000 });
  await primeiroCard.getByRole("button", { name: "Ver extrato no período" }).click();
  await page.getByRole("button", { name: "Série histórica" }).click();
  await page
    .locator(".dash-funnel")
    .getByText("Carregando...")
    .waitFor({ state: "hidden", timeout: 10000 })
    .catch(() => {});
  const serieRenderizou =
    (await page.getByText(/Nenhum snapshot mensal ainda/).count()) > 0 ||
    (await page.locator(".dash-table").count()) > 0;
  if (!serieRenderizou) {
    consoleErrors.push(`[${label}] aba Série histórica não renderizou nem dado nem estado vazio`);
  }
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint21-03-serie-historica.png`),
    fullPage: true,
  });

  // ---- 4. Logout (sempre por último — invalida a sessão) ----
  await navButton(page, "Configurações").click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page
    .getByRole("link", { name: "Entrar com Google" })
    .waitFor({ state: "visible", timeout: 10000 });
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint21-04-logout.png`),
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
        path: path.join(shotsDir, `${label}-sprint21-ERRO.png`),
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
process.exit(consoleErrors.length ? 1 : 0);
