// Sprint 36 (PRD-036a) — captura Ativos, Passivos, Orçamento (sessão
// autenticada) e Login (fluxo standalone, sem sessão) em claro/escuro x
// desktop/mobile. Escuro é emulado via colorScheme do Playwright
// (prefers-color-scheme) — o app não tem toggle de tema próprio, só a media
// query em index.css.

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

async function runAuthenticated(browser, viewport, colorScheme, label) {
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

  // Ativos
  await page.getByRole("button", { name: "Ativos", exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shotsDir, `sprint36a-ativos-${label}.png`), fullPage: true });

  // Passivos
  await page.getByRole("button", { name: "Passivos", exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `sprint36a-passivos-${label}.png`),
    fullPage: true,
  });

  // Orçamento
  await page.getByRole("button", { name: "Orçamento", exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `sprint36a-orcamento-${label}.png`),
    fullPage: true,
  });

  console.log(`[${label}] done`);
  await context.close();
}

// Login não usa cookie de sessão — fluxo standalone, mesma tela que um
// usuário deslogado vê ao abrir a URL raiz.
async function runLogin(browser, viewport, colorScheme, label) {
  const context = await browser.newContext({ viewport, colorScheme });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[login-${label}] ${msg.text()}`);
  });
  page.on("pageerror", (err) =>
    consoleErrors.push(`[login-${label}] pageerror: ${err.message}`)
  );

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(shotsDir, `sprint36a-login-${label}.png`),
    fullPage: true,
  });

  console.log(`[login-${label}] done`);
  await context.close();
}

const browser = await chromium.launch();
try {
  await runAuthenticated(browser, { width: 1440, height: 900 }, "light", "desktop-claro");
  await runAuthenticated(browser, { width: 1440, height: 900 }, "dark", "desktop-escuro");
  await runAuthenticated(browser, { width: 390, height: 844 }, "light", "mobile-claro");
  await runAuthenticated(browser, { width: 390, height: 844 }, "dark", "mobile-escuro");

  await runLogin(browser, { width: 1440, height: 900 }, "light", "desktop-claro");
  await runLogin(browser, { width: 1440, height: 900 }, "dark", "desktop-escuro");
  await runLogin(browser, { width: 390, height: 844 }, "light", "mobile-claro");
  await runLogin(browser, { width: 390, height: 844 }, "dark", "mobile-escuro");
} finally {
  await browser.close();
}

console.log(consoleErrors.length ? consoleErrors.join("\n") : "no console errors");
