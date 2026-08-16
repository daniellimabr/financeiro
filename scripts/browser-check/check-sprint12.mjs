// QA visual da Sprint 12 — tela "Natureza": 3 cards de visibilidade
// (Fixo recorrente/Variável recorrente/Custo eventual) com sparkline,
// drill-down natureza > subcategoria > transação, e tabela de classificação
// de subcategorias agrupada por categoria. Roda contra a conta real do CEO
// na VM de dev — a única mutação real do script é a natureza de UMA
// subcategoria (primeira linha da tabela), usada pra validar o fluxo de
// edição fim a fim (PRD-012, critério 4). O valor original (capturado via
// GET /subcategories antes de qualquer clique, preservando `null` vs.
// "eventual" explícito — indistinguíveis no <select> da UI) é restaurado
// por PUT direto em `finally`, mesmo que um passo acima falhe.

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
  page.on("pageerror", (err) =>
    consoleErrors.push(`[${label}] pageerror: ${err.message}`),
  );

  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Natureza" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint12-01-pagina.png`),
    fullPage: true,
  });

  // 3 cards de visibilidade, com sparkline/percentual, no resumo
  const summary = page.locator(".dash-summary");
  const cardFixa = summary.getByRole("button", { name: /Fixo recorrente/ });
  const cardVariavel = summary.getByRole("button", {
    name: /Variável recorrente/,
  });
  const cardEventual = summary.getByRole("button", { name: /Custo eventual/ });
  if (
    (await cardFixa.count()) === 0 ||
    (await cardVariavel.count()) === 0 ||
    (await cardEventual.count()) === 0
  ) {
    consoleErrors.push(
      `[${label}] os 3 cards de natureza não foram encontrados no resumo`,
    );
  }

  // drill-down: natureza > subcategoria > transação (funil, fora do card)
  if (await cardFixa.count()) {
    await cardFixa.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint12-02-drilldown-natureza.png`),
      fullPage: true,
    });

    const primeiraSubcategoria = page
      .locator(".dash-funnel .dash-accordion .dash-row")
      .first();
    if (await primeiraSubcategoria.count()) {
      await primeiraSubcategoria.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(
          shotsDir,
          `${label}-sprint12-03-drilldown-transacoes.png`,
        ),
        fullPage: true,
      });
    }

    await page.getByRole("button", { name: "Fechar" }).click();
    await page.waitForTimeout(300);
  }

  // toggle despesa/receita — reflete nos 3 cards e na tendência
  const toggleReceita = page.getByRole("button", { name: "Receita" });
  if (await toggleReceita.count()) {
    await toggleReceita.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(shotsDir, `${label}-sprint12-04-toggle-receita.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Despesa" }).click();
    await page.waitForTimeout(300);
  }

  // tabela de classificação, agrupada por categoria
  await page.screenshot({
    path: path.join(shotsDir, `${label}-sprint12-05-tabela-classificacao.png`),
    fullPage: true,
  });

  // única mutação real do script: natureza da 1a subcategoria da lista real
  // (não há registro sintético pra escopar — a tabela só lista dado real do
  // CEO). Captura o valor original via API (preserva null vs. "eventual"
  // explícito, indistinguíveis no <select>) antes de qualquer clique, e
  // restaura por PUT direto em `finally`.
  const subcategoriesResponse = await page.request.get(
    new URL("/subcategories", url).toString(),
  );
  const subcategories = await subcategoriesResponse.json();
  const alvo = subcategories[0];

  if (!alvo) {
    consoleErrors.push(
      `[${label}] nenhuma subcategoria encontrada pra testar a edição de natureza`,
    );
  } else {
    const valorOriginal = alvo.natureza;
    const valorNaSelect = valorOriginal ?? "eventual";
    const proximoValor = valorNaSelect === "fixa" ? "variavel" : "fixa";
    const select = page.getByLabel(`Natureza de ${alvo.nome}`);

    try {
      if ((await select.count()) === 0) {
        consoleErrors.push(
          `[${label}] seletor de natureza não encontrado para "${alvo.nome}" (id ${alvo.id})`,
        );
      } else {
        await select.scrollIntoViewIfNeeded();
        await select.selectOption(proximoValor);
        await page.waitForResponse(
          (res) =>
            res.url().endsWith(`/subcategories/${alvo.id}`) &&
            res.request().method() === "PUT",
        );
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(
            shotsDir,
            `${label}-sprint12-06-natureza-editada.png`,
          ),
          fullPage: true,
        });

        const valorAposEdicao = await select.inputValue();
        if (valorAposEdicao !== proximoValor) {
          consoleErrors.push(
            `[${label}] select de natureza não refletiu o novo valor após a edição (esperado ${proximoValor}, achou ${valorAposEdicao})`,
          );
        }
      }
    } finally {
      const restore = await page.request.put(
        new URL(`/subcategories/${alvo.id}`, url).toString(),
        {
          headers: { "Content-Type": "application/json" },
          data: {
            group_id: alvo.group_id,
            nome: alvo.nome,
            natureza: valorOriginal,
          },
        },
      );
      if (!restore.ok()) {
        consoleErrors.push(
          `[${label}] limpeza falhou: PUT de restauração de natureza retornou ${restore.status()} para "${alvo.nome}" (id ${alvo.id})`,
        );
      } else {
        const restored = await restore.json();
        if (restored.natureza !== valorOriginal) {
          consoleErrors.push(
            `[${label}] limpeza falhou: natureza de "${alvo.nome}" ficou "${restored.natureza}", esperado "${valorOriginal}"`,
          );
        }
      }
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

console.log(
  consoleErrors.length ? consoleErrors.join("\n") : "no console errors",
);
