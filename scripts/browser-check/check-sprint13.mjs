// QA visual da Sprint 13 — rótulo "Eventual" (não mais "Custo eventual"),
// funil de Natureza com o nível Categoria (Natureza > Categoria >
// Subcategoria > Transação), e a tabela/lista/botão unificados nas 9
// superfícies do app (Categorização, Natureza-classificação, drill-downs de
// Dashboard/Natureza/Ativos/Passivos, breakdown de Patrimônio, Gestão de
// Contas + diálogo de sincronização, cards de Ativos/Passivos). Roda contra
// dado real da conta do CEO na VM de dev — script é só leitura (nenhuma
// criação/exclusão), então não há mutação para desfazer.

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

async function hoverChangesBackground(locator) {
  if ((await locator.count()) === 0) return null;
  const before = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  await locator.hover();
  await locator.page().waitForTimeout(150);
  const after = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  return before !== after;
}

// Os cards de resumo do Dashboard (Ativos/Passivos) têm o mesmo texto do
// item de nav ("Ativos", "Passivos") como parte do accessible name
// concatenado (ex.: "Ativos R$ 50.000,00") — getByRole por nome faz
// substring match por padrão, então clique de navegação precisa ficar
// restrito a .app-nav pra não colidir com o card.
function navButton(page, label) {
  return page.locator(".app-nav").getByRole("button", { name: label, exact: true });
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

  // ---- 1. Natureza: rótulo "Eventual", nunca "Custo eventual" ----
  await navButton(page, "Natureza").click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint13-01-natureza.png`),
    fullPage: true,
  });

  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("Custo eventual")) {
    consoleErrors.push(`[${label}] "Custo eventual" ainda aparece na página — rename incompleto`);
  }
  const cardEventual = page.locator(".dash-summary").getByRole("button", { name: /Eventual/ });
  if ((await cardEventual.count()) === 0) {
    consoleErrors.push(`[${label}] card "Eventual" não encontrado no resumo de Natureza`);
  }

  // opções do <select> de natureza na tabela de classificação — o rename
  // trocou 3 <option> hardcoded por um .map(), checar que nenhuma sobrou
  // com o texto antigo mesmo sem estar selecionada.
  const selectOptionTexts = await page
    .locator(".nat-table select")
    .first()
    .locator("option")
    .allInnerTexts();
  if (!selectOptionTexts.includes("Eventual") || selectOptionTexts.includes("Custo eventual")) {
    consoleErrors.push(
      `[${label}] opções do select de natureza não batem com o rename: ${JSON.stringify(selectOptionTexts)}`
    );
  }

  // ---- 2. Funil de 4 níveis: Natureza > Categoria > Subcategoria > Transação ----
  if (await cardEventual.count()) {
    await cardEventual.click();
    await page.waitForTimeout(500);
    const funnel = page.locator(".dash-funnel");
    // Escopo por filho direto (> .dash-accordion-item > button.dash-row) —
    // sem isso, uma vez que o painel de uma categoria expande, a lista
    // aninhada de subcategorias também casa com ".dash-accordion > li >
    // button.dash-row" e o locator resolve pra vários botões em vez de um.
    const grupoRow = funnel
      .locator(".dash-accordion")
      .first()
      .locator("> li")
      .first()
      .locator("> .dash-accordion-item > button.dash-row");
    if (await grupoRow.count()) {
      await grupoRow.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint13-02-funil-categoria.png`),
        fullPage: true,
      });

      const subcategoriaRow = funnel
        .locator(".dash-accordion-panel .dash-accordion")
        .first()
        .locator("> li")
        .first()
        .locator("> .dash-accordion-item > button.dash-row");
      if (await subcategoriaRow.count()) {
        // percentual presente nos dois níveis já abertos (Categoria + Subcategoria)
        const pctCount = await funnel.locator(".pct").count();
        if (pctCount < 2) {
          consoleErrors.push(
            `[${label}] esperava percentual em pelo menos 2 níveis do funil (Categoria+Subcategoria), achou ${pctCount}`
          );
        }
        await subcategoriaRow.click();
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(shotsDir, `${label}-sprint13-03-funil-transacoes.png`),
          fullPage: true,
        });
      }

      // múltiplas categorias podem ficar expandidas ao mesmo tempo — abrir
      // uma segunda, se existir, sem fechar a primeira (checa a classe
      // "expanded" de cada botão diretamente, não uma contagem agregada,
      // que se mostrou frágil contra a estrutura aninhada do funil).
      const segundaCategoria = funnel
        .locator(".dash-accordion")
        .first()
        .locator("> li")
        .nth(1)
        .locator("> .dash-accordion-item > button.dash-row");
      if (await segundaCategoria.count()) {
        await segundaCategoria.click();
        await page.waitForTimeout(400);
        const primeiraAindaExpandida = (await grupoRow.getAttribute("class"))?.includes("expanded");
        const segundaExpandida = (await segundaCategoria.getAttribute("class"))?.includes("expanded");
        if (!primeiraAindaExpandida || !segundaExpandida) {
          consoleErrors.push(
            `[${label}] esperava as 2 categorias clicadas expandidas ao mesmo tempo (primeira=${primeiraAindaExpandida}, segunda=${segundaExpandida})`
          );
        }
      }
    } else {
      consoleErrors.push(`[${label}] funil de Natureza não abriu nenhuma linha de Categoria`);
    }
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.waitForTimeout(300);
  }

  // ---- 3. Hover + sort na tabela de classificação de Natureza ----
  const classRow = page.locator(".nat-table tbody tr").first();
  const hoverChanged = await hoverChangesBackground(classRow);
  if (hoverChanged === false) {
    consoleErrors.push(`[${label}] hover não muda o fundo da linha em .nat-table`);
  }
  const catHeader = page
    .getByRole("columnheader", { name: "Categoria", exact: true })
    .getByRole("button");
  if (await catHeader.count()) {
    await catHeader.click();
    await page.waitForTimeout(200);
    const ariaSort = await page
      .locator(".nat-table th.sortable")
      .first()
      .getAttribute("aria-sort");
    if (ariaSort === "none" || ariaSort === null) {
      consoleErrors.push(`[${label}] clicar em "Categoria" não ativou sort em .nat-table`);
    }
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint13-04-nat-table-sort.png`),
    fullPage: true,
  });

  // ---- 4. Categorização: hover + sort na tabela unificada ----
  await navButton(page, "Categorizar").click();
  await page.waitForTimeout(600);
  await page.getByLabel("Status").selectOption("todas");
  await page.waitForTimeout(600);
  const catRow = page.locator(".cat-review-table tbody tr").first();
  const catHoverChanged = await hoverChangesBackground(catRow);
  if (catHoverChanged === false) {
    consoleErrors.push(`[${label}] hover não muda o fundo da linha em .cat-review-table`);
  }
  const dataHeader = page
    .locator(".cat-review-table")
    .getByRole("columnheader", { name: "Data" })
    .getByRole("button");
  if (await dataHeader.count()) {
    await dataHeader.click();
    await page.waitForTimeout(200);
    const ariaSort = await page
      .locator(".cat-review-table th.sortable")
      .first()
      .getAttribute("aria-sort");
    if (ariaSort === "none" || ariaSort === null) {
      consoleErrors.push(`[${label}] clicar em "Data" não ativou sort em .cat-review-table`);
    }
  } else {
    consoleErrors.push(`[${label}] cabeçalho "Data" ordenável não encontrado em Categorização`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint13-05-categorizacao-sort.png`),
    fullPage: true,
  });

  // ---- 5. Dashboard: drill-down (TransactionsTable) hover + sort + colgroup ----
  await navButton(page, "Dashboards").click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Despesa/ }).click();
  await page.waitForTimeout(500);
  const dashFunnel = page.locator(".dash-funnel");
  const dashGrupoRow = dashFunnel.locator(".dash-accordion > li").first().locator("button.dash-row");
  if (await dashGrupoRow.count()) {
    await dashGrupoRow.click();
    await page.waitForTimeout(400);
    const dashSubRow = dashFunnel
      .locator(".dash-accordion-panel .dash-accordion > li")
      .first()
      .locator("button.dash-row");
    if (await dashSubRow.count()) {
      await dashSubRow.click();
      await page.waitForTimeout(400);
      const txnTable = dashFunnel.locator("table.txn-table").first();
      if (await txnTable.count()) {
        const colCount = await txnTable.locator("colgroup col").count();
        if (colCount === 0) {
          consoleErrors.push(`[${label}] tabela de transação do Dashboard sem <colgroup>`);
        }
        const txnRow = txnTable.locator("tbody tr").first();
        const txnHover = await hoverChangesBackground(txnRow);
        if (txnHover === false) {
          consoleErrors.push(`[${label}] hover não muda o fundo em table.txn-table (Dashboard)`);
        }
        const valorHeader = txnTable.getByRole("columnheader", { name: "Valor" }).getByRole("button");
        if (await valorHeader.count()) {
          await valorHeader.click();
          await page.waitForTimeout(200);
        }
      }
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint13-06-dashboard-txn-table.png`),
        fullPage: true,
      });
    }
  }

  // ---- 6. Ativos: hierarquia de botão (só "Ver gasto" Default) + drill-down ----
  await navButton(page, "Ativos").click();
  await page.waitForTimeout(600);
  const primeiroCardAtivo = page.locator(".dash-summary .dash-tile").first();
  if (await primeiroCardAtivo.count()) {
    const excluirBtn = primeiroCardAtivo.getByRole("button", { name: "Excluir" });
    const verGastoBtn = primeiroCardAtivo.getByRole("button", { name: "Ver gasto no período" });
    if ((await excluirBtn.count()) && (await verGastoBtn.count())) {
      const excluirClass = await excluirBtn.getAttribute("class");
      const verGastoClass = await verGastoBtn.getAttribute("class");
      if (!excluirClass?.includes("btn-danger") || !excluirClass?.includes("btn-ghost")) {
        consoleErrors.push(
          `[${label}] "Excluir" no card de Ativo não tem as classes btn-ghost/btn-danger esperadas (${excluirClass})`
        );
      }
      if (verGastoClass?.includes("btn-ghost")) {
        consoleErrors.push(`[${label}] "Ver gasto no período" não deveria ser Ghost`);
      }
      const excluirColor = await excluirBtn.evaluate((el) => getComputedStyle(el).color);
      const verGastoColor = await verGastoBtn.evaluate((el) => getComputedStyle(el).color);
      if (excluirColor === verGastoColor) {
        consoleErrors.push(
          `[${label}] "Excluir" e "Ver gasto no período" renderizam a mesma cor de texto (${excluirColor}) — hierarquia de botão não aplicada`
        );
      }
    }

    if (await verGastoBtn.count()) {
      await verGastoBtn.click();
      await page.waitForTimeout(500);
      const assetTable = page.locator(".dash-funnel table.txn-table").first();
      if (await assetTable.count()) {
        const temCategoria = (await assetTable.getByRole("columnheader", { name: "Categoria" }).count()) > 0;
        if (!temCategoria) {
          consoleErrors.push(
            `[${label}] AssetDrilldown não mostra coluna Categoria (paridade com Dashboard/Passivos, PRD-013 critério 3)`
          );
        }
      }
      await page.screenshot({
        path: path.join(shotsDir, `${label}-sprint13-07-ativos-drilldown.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Fechar", exact: true }).click();
      await page.waitForTimeout(300);
    }
  }

  // ---- 7. Passivos: mesma hierarquia de botão ----
  await navButton(page, "Passivos").click();
  await page.waitForTimeout(600);
  const primeiroCardPassivo = page.locator(".dash-summary .dash-tile").first();
  if (await primeiroCardPassivo.count()) {
    const excluirBtn = primeiroCardPassivo.getByRole("button", { name: "Excluir" });
    if (await excluirBtn.count()) {
      const excluirClass = await excluirBtn.getAttribute("class");
      if (!excluirClass?.includes("btn-danger")) {
        consoleErrors.push(`[${label}] "Excluir" no card de Passivo sem btn-danger (${excluirClass})`);
      }
    }
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint13-08-passivos.png`),
    fullPage: true,
  });

  // breakdown de Patrimônio (Dashboards) — colgroup trivial de 3 colunas
  await navButton(page, "Dashboards").click();
  await page.waitForTimeout(500);
  const fecharFunil = page.getByRole("button", { name: "Fechar", exact: true });
  if (await fecharFunil.count()) {
    await fecharFunil.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "Patrimônio" }).click();
  await page.waitForTimeout(500);
  const patrimonioColgroup = await page.locator("table.patrimonio-table colgroup col").count();
  if (patrimonioColgroup !== 3) {
    consoleErrors.push(
      `[${label}] breakdown de Patrimônio sem colgroup de 3 colunas (achou ${patrimonioColgroup})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint13-09-patrimonio.png`),
    fullPage: true,
  });

  // ---- 8. Gestão de Contas: .simple-list ----
  await navButton(page, "Gestão de contas").click();
  await page.waitForTimeout(600);
  const contaRow = page.locator("ul.simple-list li").first();
  if (await contaRow.count()) {
    const listHoverChanged = await hoverChangesBackground(contaRow);
    if (listHoverChanged === false) {
      consoleErrors.push(`[${label}] hover não muda o fundo em ul.simple-list (Gestão de Contas)`);
    }
  } else {
    consoleErrors.push(`[${label}] ul.simple-list não encontrada em Gestão de Contas`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint13-10-gestao-contas.png`),
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
