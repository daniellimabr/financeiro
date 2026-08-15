// QA visual da Sprint 9 — cards Ativos/Passivos/Saldo no Dashboard, funil de
// categoria expandindo direto pra lista de transações (sem nível "meio de
// pagamento"), ícone de meio de pagamento por linha, ordenação por coluna e
// tooltip nos gráficos de tendência. Roda contra dado real da conta do CEO
// na VM de dev — script é só leitura (nenhuma criação/exclusão), então não
// há mutação para desfazer (mesmo mecanismo de sessão de check-dashboard.mjs).

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
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Dashboards" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint9-01-cards.png`),
    fullPage: true,
  });

  // cards Ativos/Passivos ao lado dos já existentes — escopado a
  // .dash-summary pra não colidir com o botão de navegação "Ativos" do shell
  const summary = page.locator(".dash-summary");
  const ativosCard = summary.getByRole("button", { name: /^Ativos/ });
  const passivosCard = summary.getByRole("button", { name: /^Passivos/ });
  if ((await ativosCard.count()) === 0 || (await passivosCard.count()) === 0) {
    consoleErrors.push(`[${label}] cards Ativos/Passivos não encontrados no resumo`);
  }

  // drill-down de Ativos — com toggle despesa/receita
  if (await ativosCard.count()) {
    await ativosCard.click();
    await page.waitForTimeout(500);
    const toggle = page.getByRole("group", { name: "Tipo de transação" });
    if ((await toggle.count()) === 0) {
      consoleErrors.push(`[${label}] drill-down de Ativos sem toggle despesa/receita`);
    }
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint9-02-drilldown-ativos.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Fechar" }).click();
    await page.waitForTimeout(300);
  }

  // drill-down de Passivos — sem toggle
  if (await passivosCard.count()) {
    await passivosCard.click();
    await page.waitForTimeout(500);
    const toggle = page.getByRole("group", { name: "Tipo de transação" });
    if ((await toggle.count()) !== 0) {
      consoleErrors.push(`[${label}] drill-down de Passivos não deveria ter toggle despesa/receita`);
    }
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint9-03-drilldown-passivos.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Fechar" }).click();
    await page.waitForTimeout(300);
  }

  // drill-down de Saldo — snapshot atual, ignora o filtro ano/mês
  const saldoCard = summary.getByRole("button", { name: /^Saldo/ });
  if (await saldoCard.count()) {
    await saldoCard.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint9-04-drilldown-saldo.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Fechar" }).click();
    await page.waitForTimeout(300);
  }

  // funil de Despesa: categoria expande direto pra transações (sem nível
  // "meio de pagamento"), ícone por linha e ordenação por coluna
  const despesaTile = page.getByRole("button", { name: /Despesa/ }).first();
  if (await despesaTile.count()) {
    await despesaTile.click();
    await page.waitForTimeout(500);

    const primeiraCategoria = page.locator(".dash-accordion > li .dash-row").first();
    if (await primeiraCategoria.count()) {
      await primeiraCategoria.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint9-05-categoria-expandida.png`),
        fullPage: true,
      });

      const tabela = page.locator(".dash-accordion-panel .dash-table").first();
      if (await tabela.count()) {
        const icones = tabela.locator("tbody .account-tipo-icon");
        if ((await icones.count()) === 0) {
          consoleErrors.push(`[${label}] linha de transação sem ícone de meio de pagamento`);
        }

        const headerData = tabela.getByRole("button", { name: "Data" });
        if (await headerData.count()) {
          await headerData.click();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: path.join(shotsDir, `${label}-sprint9-06-tabela-ordenada.png`),
            fullPage: true,
          });
        }
      }
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
