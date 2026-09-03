// Sprint 37 (PRD-037) — valida o fluxo de conta demo de ponta a ponta contra
// a VM de dev: login real do CEO (token) → Configurações → "Entrar no modo
// demo" (troca de cookie via GET /demo/enter) → confirma dado renderizado em
// Dashboards/Categorizar/Ativos/Passivos/Investimentos/Orçamento/Natureza →
// "Sair do modo demo" → cookie do CEO restaurado (login de volta na conta
// real). Diálogos nativos (window.confirm) são aceitos automaticamente.

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
  console.error("defina FINANCEIRO_SESSION_TOKEN (sessão real do CEO) no ambiente");
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

  // Configurações — painel "Modo Demo" só visível para o CEO
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `sprint37-configuracoes-antes-${label}.png`),
    fullPage: true,
  });

  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.getByRole("button", { name: "Entrar no modo demo" }).click(),
  ]);
  await page.waitForTimeout(300);

  const banner = page.getByText(/MODO DEMO/);
  if (!(await banner.isVisible())) {
    console.error(`[${label}] banner MODO DEMO não apareceu após /demo/enter`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `sprint37-banner-demo-${label}.png`),
    fullPage: true,
  });

  const telas = [
    ["Dashboards", "dashboards"],
    ["Categorizar", "categorizar"],
    ["Ativos", "ativos"],
    ["Investimentos", "investimentos"],
    ["Passivos", "passivos"],
    ["Natureza", "natureza"],
    ["Orçamento", "orcamento"],
  ];
  for (const [label_pt, slug] of telas) {
    await page.getByRole("button", { name: label_pt, exact: true }).click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(shotsDir, `sprint37-${slug}-${label}.png`),
      fullPage: true,
    });
  }

  // Sair do modo demo — volta para a tela de login
  await page.getByRole("button", { name: "Sair do modo demo" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(shotsDir, `sprint37-pos-logout-${label}.png`),
    fullPage: true,
  });

  console.log(`[${label}] done`);
  await context.close();
}

const browser = await chromium.launch();
try {
  await run(browser, { width: 1440, height: 900 }, "light", "desktop-claro");
  await run(browser, { width: 390, height: 844 }, "light", "mobile-claro");
} finally {
  await browser.close();
}

console.log(consoleErrors.length ? consoleErrors.join("\n") : "no console errors");
