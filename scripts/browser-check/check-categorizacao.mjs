// QA visual pontual: filtro ano/mês + paginação na fila de Categorização
// (feedback do CEO pós-Sprint 6 — botão Confirmar parecia travar).
//
// Sprint 11: cobre também o CategoryCombobox novo que substituiu o <select>
// nativo de subcategoria (abrir, digitar/filtrar, navegar por teclado,
// selecionar) e o badge de status (Pendente/Confirmada). O teste do
// combobox roda numa linha **pendente** de propósito — nesse estado a
// escolha fica em estado local (não muta via API até "Confirmar"/"Aprovar
// marcadas", ver PRD-011), então não precisa desfazer nada no final: nunca
// clica em "Confirmar" nem "Aprovar marcadas" para uma seleção de QA.
// Também roda contra fila real com centenas de pendências (achado de
// performance da Sprint 6 foi nesta mesma tela) — mede o tempo de abrir o
// combobox pra pegar qualquer degradação de uma instância por linha.

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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Categorizar" }).click();
await page.waitForTimeout(600);
await page.screenshot({
  path: path.join(shotsDir, "categorizacao-01-pagina1.png"),
  fullPage: true,
});

const t0 = Date.now();
await page.getByRole("button", { name: "Próxima →" }).click();
await page.waitForTimeout(600);
const elapsed = Date.now() - t0;
await page.screenshot({
  path: path.join(shotsDir, "categorizacao-02-pagina2.png"),
  fullPage: true,
});

console.log(`clique em "Próxima" -> render em ~${elapsed}ms`);

// --- badge de status: pílula visual, não texto simples --------------------
const badges = page.locator(".dash-table tbody .status-badge");
if ((await badges.count()) === 0) {
  consoleErrors.push("badge de status ausente na tabela");
} else {
  const classes = await badges.first().getAttribute("class");
  if (!/status-badge--(pending|confirmed)/.test(classes ?? "")) {
    consoleErrors.push(`badge sem variante pending/confirmed: "${classes}"`);
  }
}

// --- CategoryCombobox: abrir, digitar/filtrar, navegar, selecionar --------
// roda numa linha pendente — a escolha fica em estado local, nunca é
// confirmada, então não muta nada na conta real.
const primeiraLinhaPendente = page
  .locator(".dash-table tbody tr")
  .filter({
    has: page.locator(".status-badge--pending"),
  })
  .first();

if ((await primeiraLinhaPendente.count()) === 0) {
  consoleErrors.push("nenhuma linha pendente na página 2 pra testar o combobox");
} else {
  const combo = primeiraLinhaPendente.getByRole("combobox", { name: /^Categoria de/ });
  const tAbrir0 = Date.now();
  await combo.click();
  const listbox = page.getByRole("listbox");
  await listbox.waitFor({ state: "visible", timeout: 2000 });
  const tAbrir = Date.now() - tAbrir0;
  await page.screenshot({
    path: path.join(shotsDir, "categorizacao-03-combobox-aberto.png"),
    fullPage: true,
  });

  const totalOpcoes = await listbox.getByRole("option").count();
  console.log(`combobox abriu em ~${tAbrir}ms com ${totalOpcoes} opções`);
  if (tAbrir > 500) {
    consoleErrors.push(
      `combobox demorou ${tAbrir}ms pra abrir (>500ms, possível regressão de perf)`
    );
  }

  await combo.pressSequentially("aliment");
  await page.waitForTimeout(200);
  const opcoesFiltradas = await listbox.getByRole("option").count();
  if (opcoesFiltradas === 0 || opcoesFiltradas >= totalOpcoes) {
    consoleErrors.push(
      `filtro por digitação não reduziu a lista (${totalOpcoes} -> ${opcoesFiltradas})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, "categorizacao-04-combobox-filtrado.png"),
    fullPage: true,
  });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  if (await page.getByRole("listbox").count()) {
    consoleErrors.push("Escape não fechou o combobox");
  }

  await combo.click();
  await listbox.waitFor({ state: "visible", timeout: 2000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  if (await page.getByRole("listbox").count()) {
    consoleErrors.push("Enter não fechou o combobox após selecionar");
  }
  await page.screenshot({
    path: path.join(shotsDir, "categorizacao-05-combobox-selecionado-por-teclado.png"),
    fullPage: true,
  });
}

console.log(consoleErrors.length ? consoleErrors.join("\n") : "no console errors");
await browser.close();
if (consoleErrors.length) process.exitCode = 1;
