// QA visual da Sprint 7 — filtro tipo/status + seleção em lote + descrição
// editável na fila de Categorização, e a tela nova de Gestão de Contas
// (apelido, sync_enabled, diálogo de sincronização unificada). Interações
// que mutariam dado real da VM de dev (aprovar lote, salvar descrição,
// confirmar sync) são canceladas via Escape/"Cancelar" antes de screenshot,
// mesmo mecanismo de sessão de check-sanfona.mjs.

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
  await page.getByRole("button", { name: "Categorizar" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint7-01-fila-pendente.png`),
    fullPage: true,
  });

  // filtro tipo/status
  await page.getByLabel("Status").selectOption("todas");
  await page.waitForTimeout(500);
  await page.getByLabel("Tipo").selectOption("debito");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint7-02-filtro-todas-despesa.png`),
    fullPage: true,
  });
  await page.getByLabel("Status").selectOption("pendente");
  await page.getByLabel("Tipo").selectOption("todos");
  await page.waitForTimeout(500);

  // seleção em lote (marca, screenshot, desmarca — não submete)
  const primeiroCheckbox = page.locator('tbody input[type="checkbox"]').first();
  if (await primeiroCheckbox.count()) {
    await primeiroCheckbox.check();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint7-03-lote-marcado.png`),
      fullPage: true,
    });
    await primeiroCheckbox.uncheck();
  }

  // descrição editável inline (cancelada via Escape — não persiste)
  const primeiraDescricao = page.locator("td button").first();
  if (await primeiraDescricao.count()) {
    await primeiraDescricao.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint7-04-descricao-editando.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Gestão de Contas
  await page.getByRole("button", { name: "Gestão de contas" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint7-05-gestao-contas.png`),
    fullPage: true,
  });

  const editarConta = page.getByRole("button", { name: "Editar" }).first();
  if (await editarConta.count()) {
    await editarConta.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint7-06-conta-editando.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.waitForTimeout(300);
  }

  const sincronizar = page.getByRole("button", { name: "Sincronizar MeuPluggy" });
  if (await sincronizar.count()) {
    await sincronizar.click();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint7-07-dialogo-sync.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancelar" }).click();
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
