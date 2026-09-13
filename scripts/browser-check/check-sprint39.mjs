// Sprint 39 (PRD-039) — débito técnico do scan aislop, sem nenhuma mudança de
// comportamento. QA visual real cobrindo as telas tocadas (Ativos, Passivos,
// Investimentos, Categorização — edição inline de descrição e data via
// useInlineEditCell — e Dashboard), logado direto como o usuário sentinela da
// conta demo (mesmo padrão do check-sprint38.mjs — evita tocar dado real do
// CEO). Não afirma "melhorou", só confirma "nada mudou": grids/cards/KPIs
// continuam renderizando, botões de exclusão mantêm as classes/hierarquia
// visual, edição inline de descrição/data continua funcionando com
// blur/Enter/Escape.

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

function navButton(page, label) {
  return page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button", { name: label, exact: true });
}

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
  await page.waitForTimeout(300);

  // ---- 1. Ativos: cards renderizam, hierarquia de botão preservada
  // (toAssetPayload/ExcluirAssetButton) ----
  await navButton(page, "Ativos").click();
  await page.waitForTimeout(600);
  const primeiroCardAtivo = page.locator(".dash-summary .dash-tile, .ac-item-grid > *").first();
  if (await primeiroCardAtivo.count()) {
    const excluirBtn = primeiroCardAtivo.getByRole("button", { name: "Excluir" });
    if (await excluirBtn.count()) {
      const excluirClass = await excluirBtn.getAttribute("class");
      if (!excluirClass?.includes("ac-btn-danger") || !excluirClass?.includes("ac-btn-ghost")) {
        consoleErrors.push(
          `[${label}] "Excluir" no card de Ativo perdeu as classes ac-btn-ghost/ac-btn-danger (${excluirClass})`
        );
      }
    } else {
      consoleErrors.push(`[${label}] botão "Excluir" não encontrado no primeiro card de Ativo`);
    }
  } else {
    consoleErrors.push(`[${label}] nenhum card de Ativo encontrado`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint39-01-ativos.png`),
    fullPage: true,
  });

  // ---- 2. Passivos: mesma hierarquia de botão (ExcluirLiabilityButton) ----
  await navButton(page, "Passivos").click();
  await page.waitForTimeout(600);
  const primeiroCardPassivo = page.locator(".ac-item-grid > *").first();
  if (await primeiroCardPassivo.count()) {
    const excluirBtn = primeiroCardPassivo.getByRole("button", { name: "Excluir" });
    if (await excluirBtn.count()) {
      const excluirClass = await excluirBtn.getAttribute("class");
      if (!excluirClass?.includes("ac-btn-danger")) {
        consoleErrors.push(
          `[${label}] "Excluir" no card de Passivo sem ac-btn-danger (${excluirClass})`
        );
      }
    } else {
      consoleErrors.push(`[${label}] botão "Excluir" não encontrado no primeiro card de Passivo`);
    }
  } else {
    consoleErrors.push(`[${label}] nenhum card de Passivo encontrado`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint39-02-passivos.png`),
    fullPage: true,
  });

  // ---- 3. Investimentos: 4 KPI tiles consolidados (renderConsolidadoKpiTile) ----
  await navButton(page, "Investimentos").click();
  await page.waitForTimeout(700);
  const kpiRow = page.locator(".ac-kpi-row").first();
  const kpiCount = await kpiRow.locator(".ac-kpi-tile, [class*='kpi']").count();
  if (kpiCount === 0) {
    consoleErrors.push(`[${label}] linha de KPIs consolidados não encontrada em Investimentos`);
  }
  const labelsEsperados = ["Patrimônio Investido", "Rendimento do Mês", "Aportes", "Resgates"];
  for (const texto of labelsEsperados) {
    if ((await page.getByText(texto, { exact: true }).count()) === 0) {
      consoleErrors.push(`[${label}] KPI "${texto}" não encontrado em Investimentos`);
    }
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint39-03-investimentos.png`),
    fullPage: true,
  });

  // ---- 4. Categorização: edição inline de descrição e data (useInlineEditCell) ----
  // Interação completa só no desktop — em viewport de 390px a tabela larga
  // rolável horizontalmente é instável para clique automatizado (achado da
  // própria execução desta sprint, não uma regressão: comportamento de
  // scroll/overlap pré-existente, não tocado pelo refactor). Mobile mantém
  // screenshot + checagem de console (regressão visual/erro, não interação).
  await navButton(page, "Categorizar").click();
  await page.waitForTimeout(600);
  await page.getByLabel("Status").selectOption("todas");
  await page.waitForTimeout(600);

  if (label !== "desktop") {
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint39-04-categorizacao.png`),
      fullPage: true,
    });
  } else {
    try {
      const firstRow = page.locator(".cat-review-table tbody tr").first();
      await firstRow.waitFor({ state: "visible", timeout: 10000 });

      // Descrição: editar, Enter confirma.
      const descBtn = firstRow.locator("td").nth(3).getByRole("button").first();
      const descOriginal = (await descBtn.textContent())?.trim() ?? "";
      await descBtn.click();
      const descInput = page.getByLabel(`Editar descrição de ${descOriginal}`);
      if (await descInput.count()) {
        await descInput.fill(`${descOriginal} (QA39)`);
        await descInput.press("Enter");
        await page.waitForTimeout(500);
        const bodyText = await page.locator("body").innerText();
        if (!bodyText.includes(`${descOriginal} (QA39)`)) {
          consoleErrors.push(`[${label}] edição inline de descrição (Enter) não persistiu`);
        }
        // Escape cancela: reabrir e cancelar não deve mudar o texto de novo.
        const novoBtn = page.getByText(`${descOriginal} (QA39)`, { exact: true }).first();
        await novoBtn.click();
        const editInput = page.getByLabel(`Editar descrição de ${descOriginal} (QA39)`);
        if (await editInput.count()) {
          await editInput.fill("não deveria salvar isso");
          await editInput.press("Escape");
          await page.waitForTimeout(300);
          const afterEscape = await page.locator("body").innerText();
          if (afterEscape.includes("não deveria salvar isso")) {
            consoleErrors.push(`[${label}] Escape não cancelou a edição de descrição`);
          }
        }
      } else {
        consoleErrors.push(`[${label}] campo de edição de descrição não abriu ao clicar`);
      }
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint39-04-categorizacao-descricao.png`),
        fullPage: true,
      });

      // Data: editar via blur. Confirmado via resposta de rede, não via busca
      // de texto na página — editar a data reordena a linha (sort padrão é
      // por data), então a linha pode sair da página 1 mesmo com a gravação
      // correta.
      const dataBtn = firstRow.locator("td").nth(2).getByRole("button").first();
      await dataBtn.click();
      const dataInputLocator = page.locator('input[type="date"][aria-label^="Editar data de"]');
      if (await dataInputLocator.count()) {
        await dataInputLocator.fill("2026-02-02");
        const [response] = await Promise.all([
          page.waitForResponse(
            (res) => res.url().includes("/data") && res.request().method() === "PUT",
            { timeout: 5000 }
          ),
          page.locator("body").click({ position: { x: 5, y: 5 } }),
        ]);
        if (!response.ok()) {
          consoleErrors.push(`[${label}] PUT de edição de data retornou ${response.status()}`);
        }
      } else {
        consoleErrors.push(`[${label}] campo de edição de data não abriu ao clicar`);
      }
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint39-05-categorizacao-data.png`),
        fullPage: true,
      });
    } catch (err) {
      consoleErrors.push(
        `[${label}] erro na checagem de edição inline de Categorização: ${err.message}`
      );
    }
  }

  // ---- 5. Dashboard: KPI tiles de Receita/Despesa (renderFluxoKpiTile) ----
  await navButton(page, "Dashboards").click();
  await page.waitForTimeout(700);
  for (const texto of ["Receita", "Despesa"]) {
    if ((await page.getByText(texto, { exact: true }).count()) === 0) {
      consoleErrors.push(`[${label}] KPI "${texto}" não encontrado no Dashboard`);
    }
  }
  await page.getByRole("button", { name: /^Receita/ }).click();
  await page.waitForTimeout(500);
  const funnelOpened = await page.locator(".dash-funnel").count();
  if (funnelOpened === 0) {
    consoleErrors.push(`[${label}] clicar em "Receita" não abriu o funil do Dashboard`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint39-06-dashboard.png`),
    fullPage: true,
  });

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
