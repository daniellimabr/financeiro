// QA visual da Sprint 8 — tela nova de Gestão de Ativos (grid de cards, criar
// ativo, abrir drill-down de gasto por ativo). Interações que mutariam dado
// real da VM de dev (excluir, vender) são canceladas antes de qualquer
// submissão — o ativo criado neste script é o único dado novo persistido, e
// fica cadastrado propositalmente para inspeção manual do CEO.

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
  await page.getByRole("button", { name: "Ativos" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint8-01-grid-ativos.png`),
    fullPage: true,
  });

  // criar ativo (única mutação real — fica cadastrado para inspeção do CEO)
  await page.getByRole("button", { name: "Novo ativo" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint8-02-form-novo-ativo.png`),
    fullPage: true,
  });
  await page.getByLabel("Nome").fill(`QA browser-check ${label}`);
  await page.getByLabel("Tipo do ativo").selectOption("outro");
  await page.getByLabel("Valor atual").fill("1000");
  await page.getByLabel("Data de aquisição").fill("2026-01-15");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint8-03-ativo-criado.png`),
    fullPage: true,
  });

  // drill-down de gasto no período filtrado
  const verGasto = page.getByRole("button", { name: "Ver gasto no período" }).first();
  if (await verGasto.count()) {
    await verGasto.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint8-04-drilldown-gasto.png`),
      fullPage: true,
    });
    // o botão troca de rótulo para "Fechar gasto" ao expandir — refaz o locator
    await page.getByRole("button", { name: "Fechar gasto" }).first().click();
  }

  // vender — abre o diálogo, cancela sem submeter (não muta dado real)
  const vender = page.getByRole("button", { name: "Vender" }).first();
  if (await vender.count()) {
    await vender.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint8-05-dialogo-vender.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.waitForTimeout(300);
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
