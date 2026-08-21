// Sprint 35 (PRD-035) — captura Categorizar, Categorias (drawer), Natureza e
// Configurações (drawer de Gestão de Contas) em claro/escuro x desktop/mobile.
// Escuro é emulado via colorScheme do Playwright (prefers-color-scheme) — o
// app não tem toggle de tema próprio, só a media query em index.css.

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

  // Categorizar
  await page.getByRole("button", { name: "Categorizar" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shotsDir, `sprint35-categorizar-${label}.png`), fullPage: true });

  // Drawer de Categorias, aberto a partir de Categorizar — fullPage:false
  // aqui: o painel é position:fixed, então uma captura fullPage (que
  // redimensiona o viewport pro tamanho do documento inteiro) faz o drawer
  // "descolar" e cobrir só o topo da imagem gerada, sem refletir o que um
  // usuário real vê (o backdrop sempre acompanha o viewport real). Captura
  // no tamanho do viewport mostra o drawer como ele realmente aparece.
  await page.getByRole("button", { name: "Gerenciar categorias" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotsDir, `sprint35-categorias-drawer-${label}.png`) });
  await page.getByRole("button", { name: "Fechar" }).click();
  await page.waitForTimeout(200);

  // Natureza
  await page.getByRole("button", { name: "Natureza" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shotsDir, `sprint35-natureza-${label}.png`), fullPage: true });

  // Configurações
  await page.getByRole("button", { name: "Configurações" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shotsDir, `sprint35-configuracoes-${label}.png`), fullPage: true });

  // Drawer de Gestão de contas, aberto a partir de Configurações (mesmo
  // motivo acima para fullPage:false).
  await page.getByRole("button", { name: "Gerenciar contas" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shotsDir, `sprint35-contas-drawer-${label}.png`) });

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
