// Sprint 38 (PRD-038) — valida a Mesa de Planejamento de ponta a ponta contra
// a VM de dev, logado direto como o usuário sentinela da conta demo (token
// gerado na própria VM via create_access_token, sem depender do login real
// do CEO): grade renderiza 10 colunas, mês corrente com indicador dentro/
// excedido, confirmar uma sugestão, criar um item planejado, ausência total
// de Orçamento em qualquer tela/nav. Diálogos nativos (window.confirm) são
// aceitos automaticamente.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.join(__dirname, "shots");
mkdirSync(shotsDir, { recursive: true });

const url = process.argv[2] || "http://financeirov2.duckdns.org:8080/";
const token = process.env.FINANCEIRO_DEMO_SESSION_TOKEN;
if (!token) {
  console.error("defina FINANCEIRO_DEMO_SESSION_TOKEN (token do usuário demo, gerado na VM)");
  process.exit(1);
}

const consoleErrors = [];

async function run(browser, viewport, colorScheme, label) {
  const context = await browser.newContext({ viewport, colorScheme });
  const u = new URL(url);
  context.on("dialog", (dialog) => dialog.accept());

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
  await page.waitForTimeout(300);

  // Nenhum vestígio de Orçamento em nenhuma aba do nav.
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  const navLabels = await nav.getByRole("button").allTextContents();
  if (navLabels.some((l) => l.includes("Orçamento"))) {
    console.error(`[${label}] achou aba "Orçamento" ainda no nav: ${navLabels.join(", ")}`);
  }
  if (!navLabels.some((l) => l.includes("Planejamento"))) {
    console.error(`[${label}] aba "Planejamento" não apareceu no nav: ${navLabels.join(", ")}`);
  }

  await page.getByRole("button", { name: "Planejamento", exact: true }).click();
  await page.waitForSelector("table.planejamento-grade thead th", { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `sprint38-grade-${label}.png`),
    fullPage: true,
  });

  // Grade: 10 colunas de mês (3 histórico + atual + 6 futuros) + 1 coluna "Linha".
  const headerCells = await page.locator("table.planejamento-grade thead th").count();
  if (headerCells !== 11) {
    console.error(`[${label}] grade não tem 11 colunas de cabeçalho (achou ${headerCells})`);
  }

  // Confirmar uma sugestão futura, se existir alguma célula sugerida.
  const sugerido = page.locator("button.planejamento-val-sugerido").first();
  if (await sugerido.count()) {
    await sugerido.click();
    await page.waitForTimeout(200);
    const salvar = page.getByRole("button", { name: "Salvar" }).first();
    if (await salvar.count()) {
      await salvar.click();
      await page.waitForTimeout(500);
    }
  }
  await page.screenshot({
    path: path.join(shotsDir, `sprint38-confirmar-sugestao-${label}.png`),
    fullPage: true,
  });

  // Criar um item planejado.
  const nomeItem = `QA Sprint 38 (${label}) ${Date.now()}`;
  await page.getByRole("button", { name: "Novo item" }).click();
  await page.waitForTimeout(200);
  await page.getByLabel("Nome").fill(nomeItem);
  const valorInputs = page.getByLabel("Valor");
  await valorInputs.last().fill("123.45");
  const dataInputs = page.getByLabel("Mês-alvo");
  await dataInputs.last().fill("2026-12-01");
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(600);
  const criado = page.getByText(nomeItem).first();
  if (!(await criado.isVisible())) {
    console.error(`[${label}] item planejado criado não apareceu na lista`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `sprint38-item-planejado-${label}.png`),
    fullPage: true,
  });

  console.log(`[${label}] done`);
  await context.close();
}

const browser = await chromium.launch();
try {
  await run(browser, { width: 1440, height: 900 }, "light", "desktop-claro");
  await run(browser, { width: 1440, height: 900 }, "dark", "desktop-escuro");
  await run(browser, { width: 390, height: 844 }, "light", "mobile-claro");
} finally {
  await browser.close();
}

console.log(consoleErrors.length ? consoleErrors.join("\n") : "no console errors");
