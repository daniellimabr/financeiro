// Sprint 36 (PRD-036b) — captura a tela consolidada de Investimentos (KPIs,
// gráfico, ranking, grid de entrada) e o funil individual (Posições/Série
// histórica de um investimento real) em claro/escuro x desktop/mobile.
// Atenção à tabela de série histórica (8 colunas, candidata a overflow em
// mobile) e a qualquer position:fixed novo — esta tela não introduziu
// nenhum (sem Drawer/modal), então fullPage:true é seguro em toda a captura
// (ver achado da Sprint 35, commit af9bedd, sobre position:fixed vs.
// fullPage).

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
  page.on("pageerror", (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  // Investimentos — visão consolidada (KPIs, gráfico, ranking, grid de entrada)
  await page.getByRole("button", { name: "Investimentos", exact: true }).click();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(shotsDir, `sprint36b-consolidado-${label}.png`),
    fullPage: true,
  });

  // Abre o funil do primeiro investimento da grid (default: Posições)
  const tiles = page.locator(".ac-kpi-grid button.ac-kpi");
  const count = await tiles.count();
  if (count > 0) {
    await tiles.first().click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(shotsDir, `sprint36b-funil-posicoes-${label}.png`),
      fullPage: true,
    });

    // Série histórica — a tabela de 8 colunas é a candidata a overflow
    await page.getByRole("button", { name: "Série histórica" }).click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(shotsDir, `sprint36b-funil-serie-historica-${label}.png`),
      fullPage: true,
    });
  } else {
    console.log(`[${label}] nenhum investimento cadastrado — funil não capturado`);
  }

  console.log(`[${label}] done`);
  await context.close();
}

const browser = await chromium.launch();
try {
  await run(browser, { width: 1440, height: 900 }, "light", "desktop-claro");
  await run(browser, { width: 1440, height: 900 }, "dark", "desktop-escuro");
  await run(browser, { width: 390, height: 844 }, "light", "mobile-claro");
  await run(browser, { width: 390, height: 844 }, "dark", "mobile-escuro");
} finally {
  await browser.close();
}

console.log(consoleErrors.length ? consoleErrors.join("\n") : "no console errors");
