// QA visual da Sprint 14 — tela nova "Projeção": cards Receita/Despesa/Saldo
// projetados, gráfico combinando histórico real (sólido) e projeção
// (tracejado), painel de simulação de hipotéticas (única/mensal) recalcula
// sem reload/nova chamada de rede. Roda contra dado real da conta do CEO na
// VM de dev — script é só leitura + interações locais na tela (nenhuma
// mutação de dado persistido), então não há nada para desfazer.

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
  let apiCallCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/dashboards/projecao") || req.url().includes("/dashboards/tendencia")) {
      apiCallCount += 1;
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });

  // ---- 1. Abrir Projeção, esperar os 3 cards + gráfico ----
  await navButton(page, "Projeção").click();
  await page.locator(".dash-summary").getByText("Receita projetada").waitFor({
    state: "visible",
    timeout: 10000,
  });
  await page.locator("text=Linha sólida").waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint14-01-projecao.png`),
    fullPage: true,
  });

  const receitaAntes = await cardValue(page, "Receita projetada");
  const despesaAntes = await cardValue(page, "Despesa projetada");
  const saldoAntes = await cardValue(page, "Saldo projetado");

  // ---- 2. Adicionar hipotética mensal, checar recálculo sem nova chamada de rede ----
  const callsAntes = apiCallCount;
  await page.getByLabel("Nome da hipotética").fill("Freelance extra");
  await page.getByLabel("Valor da hipotética").fill("500");
  await page.getByLabel("Tipo da hipotética").selectOption("receita");
  await page.getByLabel("Frequência da hipotética").selectOption("mensal");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.waitForTimeout(400);

  const receitaDepoisMensal = await cardValue(page, "Receita projetada");
  if (receitaDepoisMensal === receitaAntes) {
    consoleErrors.push(
      `[${label}] hipotética mensal não alterou o card Receita projetada (antes=${receitaAntes}, depois=${receitaDepoisMensal})`
    );
  }
  if (apiCallCount !== callsAntes) {
    consoleErrors.push(
      `[${label}] hipotética mensal disparou chamada de rede (esperado 0 chamadas novas, achou ${apiCallCount - callsAntes})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint14-02-hipotetica-mensal.png`),
    fullPage: true,
  });

  // ---- 3. Adicionar hipotética única, checar que não muda receita (só despesa) ----
  const callsAntesUnica = apiCallCount;
  await page.getByLabel("Nome da hipotética").fill("Reforma");
  await page.getByLabel("Valor da hipotética").fill("8000");
  await page.getByLabel("Tipo da hipotética").selectOption("despesa");
  await page.getByLabel("Frequência da hipotética").selectOption("unica");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.waitForTimeout(400);

  const despesaDepoisUnica = await cardValue(page, "Despesa projetada");
  if (despesaDepoisUnica === despesaAntes) {
    consoleErrors.push(
      `[${label}] hipotética única não alterou o card Despesa projetada (antes=${despesaAntes}, depois=${despesaDepoisUnica})`
    );
  }
  if (apiCallCount !== callsAntesUnica) {
    consoleErrors.push(
      `[${label}] hipotética única disparou chamada de rede (esperado 0 chamadas novas, achou ${apiCallCount - callsAntesUnica})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint14-03-hipotetica-unica.png`),
    fullPage: true,
  });

  // ---- 4. Remover as duas hipotéticas, cards voltam ao valor original ----
  const removerButtons = page.getByRole("button", { name: "Remover" });
  while ((await removerButtons.count()) > 0) {
    await removerButtons.first().click();
    await page.waitForTimeout(200);
  }
  const receitaFinal = await cardValue(page, "Receita projetada");
  const saldoFinal = await cardValue(page, "Saldo projetado");
  if (receitaFinal !== receitaAntes || saldoFinal !== saldoAntes) {
    consoleErrors.push(
      `[${label}] remover as hipotéticas não restaurou os valores originais (receita ${receitaAntes}->${receitaFinal}, saldo ${saldoAntes}->${saldoFinal})`
    );
  }

  // ---- 5. Trocar horizonte, checar nova chamada de rede ----
  const callsAntesHorizonte = apiCallCount;
  await page.getByLabel("Horizonte de projeção").selectOption("3");
  await page.waitForTimeout(600);
  if (apiCallCount === callsAntesHorizonte) {
    consoleErrors.push(`[${label}] trocar horizonte não disparou nova chamada de rede`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint14-04-horizonte-3.png`),
    fullPage: true,
  });

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
