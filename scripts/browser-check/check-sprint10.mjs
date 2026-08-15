// QA visual da Sprint 10 — navegação sem aba "Início" (Dashboards vira
// inicial), aba "Passivos" nova (CRUD + quitação), filtros novos de
// Categorização (associado a ativo / categoria), tooltip do sparkline sem
// "v:" (mês/ano), drill-down de Patrimônio (4 partes + link pros
// drill-downs existentes) e presença dos controles de edição inline no
// drill-down do Dashboard. Roda contra dado real da conta do CEO na VM de
// dev — a única mutação real é o passivo de QA criado (e excluído no
// final via a própria UI, mesmo padrão de check-ativos.mjs); os selects
// de edição inline no drill-down do Dashboard salvam ao trocar (sem
// diálogo de confirmação), então o script só verifica presença/aria-label
// desses controles, nunca dispara onChange neles.

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
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto(url, { waitUntil: "networkidle" });

  // --- nav sem Início, Dashboards é a tela inicial, ordem final ---------
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  const navLabels = await nav.getByRole("button").allTextContents();
  if (navLabels.includes("Início")) {
    consoleErrors.push(`[${label}] aba "Início" ainda presente no menu`);
  }
  const esperado = ["Dashboards", "Categorizar", "Ativos", "Passivos", "Gestão de contas"];
  if (JSON.stringify(navLabels) !== JSON.stringify(esperado)) {
    consoleErrors.push(`[${label}] ordem do menu inesperada: ${JSON.stringify(navLabels)}`);
  }
  const dashboardsTab = nav.getByRole("button", { name: "Dashboards" });
  if ((await dashboardsTab.getAttribute("aria-current")) !== "page") {
    consoleErrors.push(`[${label}] Dashboards não é a aba inicial`);
  }
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint10-01-nav-dashboards.png`),
    fullPage: true,
  });

  // --- tooltip do sparkline sem "v:" --------------------------------------
  const primeiraSpark = page.locator(".dash-tile .spark").first();
  if (await primeiraSpark.count()) {
    const box = await primeiraSpark.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(400);
      const tooltip = page.locator(".recharts-tooltip-wrapper").first();
      if (await tooltip.count()) {
        const texto = (await tooltip.textContent()) ?? "";
        if (/\bv\s*:/.test(texto)) {
          consoleErrors.push(`[${label}] tooltip do sparkline ainda mostra "v:": "${texto}"`);
        }
        if (!/\d{2}\/\d{4}/.test(texto)) {
          consoleErrors.push(`[${label}] tooltip do sparkline sem mês/ano (MM/AAAA): "${texto}"`);
        }
        await page.screenshot({
          path: path.join(shotsDir, `${label}-sprint10-02-tooltip-sparkline.png`),
        });
      } else {
        consoleErrors.push(`[${label}] hover no sparkline não abriu tooltip`);
      }
    }
    await page.mouse.move(0, 0);
  }

  // --- drill-down de Patrimônio: 4 partes + link pro drill-down de Ativos -
  const summary = page.locator(".dash-summary");
  const patrimonioTile = summary.getByRole("button", { name: /^Patrimônio/ });
  if (await patrimonioTile.count()) {
    await patrimonioTile.click();
    await page.waitForTimeout(500);
    const linhas = page.locator(".dash-funnel .dash-table tbody tr");
    if ((await linhas.count()) < 5) {
      // 4 partes + total
      consoleErrors.push(`[${label}] breakdown de Patrimônio sem as 4 partes + total`);
    }
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint10-03-patrimonio-breakdown.png`),
      fullPage: true,
    });

    const detalheAtivos = page.getByRole("button", { name: "Ver detalhe" }).first();
    if (await detalheAtivos.count()) {
      await detalheAtivos.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint10-04-patrimonio-para-ativos.png`),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Fechar" }).click();
    await page.waitForTimeout(300);
  } else {
    consoleErrors.push(`[${label}] card Patrimônio não é clicável`);
  }

  // --- edição inline no drill-down do Dashboard (só presença, sem submeter)
  const despesaTile = summary.getByRole("button", { name: /^Despesa/ });
  if (await despesaTile.count()) {
    await despesaTile.click();
    await page.waitForTimeout(500);
    const primeiroGrupo = page.locator(".dash-accordion > li > div > .dash-row").first();
    if (await primeiroGrupo.count()) {
      await primeiroGrupo.click();
      await page.waitForTimeout(400);
      const primeiroTipo = page
        .locator(".dash-accordion-panel > .dash-accordion > li > div > .dash-row")
        .first();
      if (await primeiroTipo.count()) {
        await primeiroTipo.click();
        await page.waitForTimeout(400);
        const tabela = page.locator(".dash-accordion-panel .dash-table").first();
        const descricaoBtn = tabela.locator("tbody button").first();
        const categoriaSelect = tabela.locator('tbody select[aria-label^="Categoria de"]').first();
        const ativoSelect = tabela.locator('tbody select[aria-label^="Ativo de"]').first();
        if (
          (await descricaoBtn.count()) === 0 ||
          (await categoriaSelect.count()) === 0 ||
          (await ativoSelect.count()) === 0
        ) {
          consoleErrors.push(
            `[${label}] drill-down do Dashboard sem controles de edição inline (descrição/categoria/ativo)`
          );
        }
        await page.screenshot({
          path: path.join(shotsDir, `${label}-sprint10-05-drilldown-edicao-inline.png`),
          fullPage: true,
        });
      }
    }
    await page.getByRole("button", { name: "Fechar" }).click();
    await page.waitForTimeout(300);
  }

  // --- Categorização: filtros novos ---------------------------------------
  await page.getByRole("button", { name: "Categorizar" }).click();
  await page.waitForTimeout(600);
  const filtroAtivo = page.getByLabel("Associado a ativo");
  const filtroCategoria = page.getByLabel("Categoria");
  if ((await filtroAtivo.count()) === 0 || (await filtroCategoria.count()) === 0) {
    consoleErrors.push(`[${label}] filtros "associado a ativo"/"categoria" ausentes`);
  } else {
    await filtroAtivo.selectOption("Sim");
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint10-06-categorizacao-filtro-ativo.png`),
      fullPage: true,
    });
    await filtroAtivo.selectOption("Todos");
    await page.waitForTimeout(300);
  }
  const icone = page.locator(".dash-table tbody .valor-cell .transaction-tipo-icon").first();
  if ((await icone.count()) === 0) {
    consoleErrors.push(`[${label}] indicador visual débito/crédito ausente na Categorização`);
  }

  // --- Passivos: CRUD + quitação (única mutação real, desfeita no final) -
  const nomePassivo = `QA browser-check ${label}`;
  await page.getByRole("button", { name: "Passivos" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint10-07-passivos-grid.png`),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Novo passivo" }).click();
  await page.waitForTimeout(300);
  await page.getByLabel("Nome").fill(nomePassivo);
  await page.getByLabel("Tipo do passivo").selectOption("outro");
  await page.getByLabel("Valor total").fill("1000");
  await page.getByLabel("Saldo devedor").fill("1000");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint10-08-passivo-criado.png`),
    fullPage: true,
  });

  const card = page.locator(".dash-tile").filter({ hasText: nomePassivo });
  try {
    const verGasto = card.getByRole("button", { name: "Ver gasto no período" });
    if (await verGasto.count()) {
      await verGasto.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint10-09-passivo-drilldown.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Fechar", exact: true }).click();
      await page.waitForTimeout(300);
    }
  } finally {
    // desfaz a única mutação real do script, mesmo que um passo acima tenha
    // falhado — nunca deixa o passivo de QA na conta do CEO
    await card.getByRole("button", { name: "Excluir" }).click();
    await page.waitForTimeout(500);
    if (await card.count()) {
      consoleErrors.push(
        `[${label}] limpeza falhou: card "${nomePassivo}" ainda presente após excluir`
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
