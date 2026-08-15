// QA visual da Sprint 8 — tela de Gestão de Ativos (grid de cards, criar
// ativo, abrir drill-down de gasto por ativo, toggle despesa/receita).
// Roda contra a VM de dev com a conta real do CEO — qualquer mutação que o
// script fizer (o ativo que ele cria) é desfeita antes do script terminar,
// via o próprio fluxo de exclusão da UI. Interações que mutariam um ativo
// já existente (excluir, vender) são canceladas antes de qualquer
// submissão e nunca tocam em cards que não foram criados por este script.

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
  // handleDelete() usa window.confirm — sem esse handler o Playwright
  // descarta o dialog por padrão e a exclusão de limpeza nunca aconteceria.
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ativos" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint8-01-grid-ativos.png`),
    fullPage: true,
  });

  // criar ativo (única mutação real do script — desfeita no final via Excluir)
  const nomeAtivo = `QA browser-check ${label}`;
  await page.getByRole("button", { name: "Novo ativo" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint8-02-form-novo-ativo.png`),
    fullPage: true,
  });
  await page.getByLabel("Nome").fill(nomeAtivo);
  await page.getByLabel("Tipo do ativo").selectOption("outro");
  await page.getByLabel("Valor atual").fill("1000");
  await page.getByLabel("Data de aquisição").fill("2026-01-15");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint8-03-ativo-criado.png`),
    fullPage: true,
  });

  // toda interação abaixo fica restrita ao card recém-criado — a listagem é
  // alfabética, então "primeiro card"/"primeiro botão" na página quase
  // sempre seria um ativo real do usuário, não este
  const card = page.locator(".dash-tile").filter({ hasText: nomeAtivo });

  try {
    // drill-down de gasto no período filtrado — fora do card, painel
    // dash-funnel abaixo da grid (mesmo padrão do funil de Dashboards)
    const verGasto = card.getByRole("button", { name: "Ver gasto no período" });
    if (await verGasto.count()) {
      await verGasto.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint8-04-drilldown-despesa.png`),
        fullPage: true,
      });

      // toggle despesa/receita — troca o total, a lista de transações e a
      // sparkline dos cards simultaneamente
      await page.getByRole("button", { name: "Receita" }).click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint8-05-drilldown-receita.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Despesa" }).click();
      await page.waitForTimeout(300);

      await page.getByRole("button", { name: "Fechar", exact: true }).click();
      await page.waitForTimeout(300);
    }

    // vender — abre o diálogo, cancela sem submeter (não muta dado real)
    const vender = card.getByRole("button", { name: "Vender" });
    if (await vender.count()) {
      await vender.click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint8-06-dialogo-vender.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Cancelar" }).click();
      await page.waitForTimeout(300);
    }
  } finally {
    // desfaz a única mutação real do script, mesmo que um passo acima tenha
    // falhado — nunca deixa o ativo de QA para trás na conta do CEO
    await card.getByRole("button", { name: "Excluir" }).click();
    await page.waitForTimeout(500);
    if (await card.count()) {
      consoleErrors.push(
        `[${label}] limpeza falhou: card "${nomeAtivo}" ainda presente após excluir`
      );
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
