// QA visual da Sprint 15 — logout, tela "Configurações" (3 seções: Perfil,
// Competência de Salário, Gestão de Contas), edição de dia de corte/ajuste
// de salário de dez/2025/saldo inicial por conta, cards novos do Dashboard
// ("Saldo Acumulado"/"Saldo Anterior", incl. caso especial jan/2026). Roda
// contra dado real da conta do CEO na VM de dev — toda mutação de dado
// persistido (dia de corte, ajuste de salário, saldo inicial) é revertida ao
// valor original capturado no início do script, mesmo padrão de limpeza já
// usado nos scripts anteriores. Logout é sempre o último passo (invalida a
// sessão do próprio script).

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

async function runSteps(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });

  // ---- 1. Abrir Configurações, checar as 3 seções ----
  await navButton(page, "Configurações").click();
  await page.getByRole("heading", { name: "Configurações" }).waitFor({ state: "visible" });
  await page.getByRole("heading", { name: "Perfil" }).waitFor({ state: "visible" });
  await page
    .getByRole("heading", { name: "Competência de Salário" })
    .waitFor({ state: "visible" });
  await page.getByRole("heading", { name: "Gestão de Contas" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint15-01-configuracoes.png`),
    fullPage: true,
  });

  // ---- 2. Editar dia de corte, revertendo ao valor original ----
  const cutoffInput = page.getByLabel("Dia de corte de competência de salário");
  const cutoffOriginal = await cutoffInput.inputValue();
  const cutoffTeste = String(((Number(cutoffOriginal) + 5 - 1) % 28) + 1);
  await cutoffInput.fill(cutoffTeste);
  await page.getByRole("button", { name: "Salvar dia de corte" }).click();
  await page.getByText("Salvo.").waitFor({ state: "visible", timeout: 5000 });
  await page.reload({ waitUntil: "networkidle" });
  await navButton(page, "Configurações").click();
  await page.getByRole("heading", { name: "Perfil" }).waitFor({ state: "visible" });
  const cutoffApósSalvar = await page
    .getByLabel("Dia de corte de competência de salário")
    .inputValue();
  if (cutoffApósSalvar !== cutoffTeste) {
    consoleErrors.push(
      `[${label}] dia de corte não persistiu (esperado ${cutoffTeste}, achou ${cutoffApósSalvar})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint15-02-cutoff-editado.png`),
    fullPage: true,
  });
  // reverte
  await page.getByLabel("Dia de corte de competência de salário").fill(cutoffOriginal);
  await page.getByRole("button", { name: "Salvar dia de corte" }).click();
  await page.getByText("Salvo.").waitFor({ state: "visible", timeout: 5000 });

  // ---- 3. Ajuste de salário de dezembro/2025: captura estado original, testa, reverte ----
  const contaSelect = page.getByLabel("Conta do salário de dezembro/2025");
  const dataInput = page.getByLabel("Data do pagamento do salário de dezembro/2025");
  const valorInput = page.getByLabel("Valor do salário de dezembro/2025");
  const ajusteAccountOriginal = await contaSelect.inputValue();
  const ajusteDataOriginal = await dataInput.inputValue();
  const ajusteValorOriginal = await valorInput.inputValue();
  // Escopa o formulário pelo campo "Valor" (único, via aria-label) — o texto
  // visível "Salário de dezembro/2025" está no <h3> fora do <form>, não
  // funciona como `hasText`.
  const ajusteForm = page.locator("form").filter({ has: valorInput });
  const ajusteSalvarButton = ajusteForm.getByRole("button", { name: "Salvar" });

  // só roda o teste de escrita se houver ao menos uma conta selecionável —
  // sem isso o formulário não pode ser submetido (mesmo guard do frontend).
  const temConta = (await contaSelect.locator("option").count()) > 1;
  if (temConta) {
    if (ajusteAccountOriginal === "") {
      const primeiraConta = await contaSelect.locator("option").nth(1).getAttribute("value");
      await contaSelect.selectOption(primeiraConta);
    }
    await valorInput.fill("1.00");
    await ajusteSalvarButton.click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint15-03-ajuste-salario-editado.png`),
      fullPage: true,
    });
    // reverte ao estado original (vazio se não havia ajuste antes, ou aos valores capturados)
    await contaSelect.selectOption(
      ajusteAccountOriginal || (await contaSelect.locator("option").nth(1).getAttribute("value"))
    );
    if (ajusteDataOriginal) await dataInput.fill(ajusteDataOriginal);
    await valorInput.fill(ajusteValorOriginal);
    await ajusteSalvarButton.click();
    await page.waitForTimeout(600);
  } else {
    consoleErrors.push(`[${label}] nenhuma conta disponível pra testar o ajuste de salário`);
  }

  // ---- 4. Saldo inicial por conta + tabela de auditoria ----
  const editarSaldoInicial = page.locator(".tag", { hasText: "Saldo inicial" }).first();
  await editarSaldoInicial.waitFor({ state: "visible" });
  const nomeConta = await editarSaldoInicial
    .locator("xpath=../strong")
    .first()
    .innerText()
    .catch(() => "conta");
  const saldoInicialOriginalTexto = await editarSaldoInicial.innerText();
  const jaTinhaSaldoInicial = !saldoInicialOriginalTexto.includes("não informado");
  await editarSaldoInicial.getByRole("button", { name: "Editar" }).click();
  const saldoInicialInput = page.getByLabel(/^Saldo inicial de /);
  const saldoInicialOriginalValor = await saldoInicialInput.inputValue();
  await saldoInicialInput.fill("1000.00");
  await page
    .locator(".tag")
    .filter({ has: page.getByRole("button", { name: "Salvar" }) })
    .getByRole("button", { name: "Salvar" })
    .click();
  await page.waitForTimeout(600);
  await page.getByRole("heading", { name: "Auditoria de saldo por conta" }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint15-04-saldo-inicial-auditoria.png`),
    fullPage: true,
  });
  const temTabelaAuditoria = (await page.locator(".dash-table").count()) > 0;
  if (!temTabelaAuditoria) {
    consoleErrors.push(`[${label}] tabela de auditoria de saldo não apareceu após editar saldo inicial (conta: ${nomeConta})`);
  }
  // reverte
  await page
    .locator(".tag", { hasText: "Saldo inicial" })
    .first()
    .getByRole("button", { name: "Editar" })
    .click();
  await page.getByLabel(/^Saldo inicial de /).fill(jaTinhaSaldoInicial ? saldoInicialOriginalValor : "");
  await page
    .locator(".tag")
    .filter({ has: page.getByRole("button", { name: "Salvar" }) })
    .getByRole("button", { name: "Salvar" })
    .click();
  await page.waitForTimeout(400);

  // ---- 5. Dashboard: cards "Saldo Acumulado"/"Saldo Anterior" ----
  await navButton(page, "Dashboards").click();
  await page.locator(".dash-summary").getByText("Saldo Acumulado", { exact: true }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator(".dash-summary").getByText(/Saldo Anterior/).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint15-05-dashboard-cards.png`),
    fullPage: true,
  });

  // Caso especial: filtra em janeiro/2026 e clica "Saldo Anterior" — deve
  // alertar, não navegar.
  await page.getByLabel("Ano").selectOption("2026");
  await page.getByLabel("Mês").selectOption("1");
  await page.waitForTimeout(500);
  let alertaRecebido = false;
  page.once("dialog", async (dialog) => {
    alertaRecebido = true;
    await dialog.accept();
  });
  await page.locator(".dash-summary .dash-tile", { hasText: "Saldo Anterior" }).click();
  await page.waitForTimeout(500);
  if (!alertaRecebido) {
    consoleErrors.push(`[${label}] clicar "Saldo Anterior" em jan/2026 não disparou alerta`);
  }
  if ((await page.getByLabel("Mês").inputValue()) !== "1") {
    consoleErrors.push(`[${label}] clicar "Saldo Anterior" em jan/2026 navegou (não deveria)`);
  }

  // Fora de jan/2026: clica "Saldo Anterior" — deve navegar o filtro pro mês anterior.
  await page.getByLabel("Mês").selectOption("3");
  await page.waitForTimeout(500);
  await page.locator(".dash-summary .dash-tile", { hasText: "Saldo Anterior" }).click();
  await page.waitForTimeout(500);
  if ((await page.getByLabel("Mês").inputValue()) !== "2") {
    consoleErrors.push(`[${label}] clicar "Saldo Anterior" em março/2026 não navegou pro mês anterior (fevereiro)`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint15-06-saldo-anterior-navegado.png`),
    fullPage: true,
  });

  // Drill-down do card "Saldo Acumulado".
  await page
    .locator(".dash-summary .dash-tile", { hasText: "Saldo Acumulado" })
    .click();
  await page.getByRole("heading", { name: "Saldo Acumulado" }).waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint15-07-saldo-acumulado-drilldown.png`),
    fullPage: true,
  });

  // ---- 6. Logout (sempre por último — invalida a sessão) ----
  await navButton(page, "Configurações").click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.getByRole("link", { name: "Entrar com Google" }).waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint15-08-logout.png`),
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
        path: path.join(shotsDir, `${label}-sprint15-ERRO.png`),
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
