// Validação ao vivo da Sprint 26: interatividade de gráficos — RowTrend
// reconstruído em Recharts (3x mais largo, com tooltip), clique num ponto de
// qualquer gráfico de linha (card, mini gráfico de linha do funil, TrendChart
// de drilldown) filtrando a tela pelo mês/ano do ponto, e "Valor atual por
// Ativo" (card Ativos) virando accordion (era tabela). Script só navega e
// fotografa/interage com dado real, não muta nada.

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

function navButton(page, label) {
  return page.locator(".app-nav").getByRole("button", { name: label, exact: true });
}

function tile(page, name) {
  return page.locator(".dash-summary .dash-tile", { hasText: name }).first();
}

// Match exato no rótulo (.k) do tile — "Saldo" também é substring de "Saldo
// Anterior"/"Saldo Acumulado", que vêm antes dele no DOM e não têm sparkline.
function tileExact(page, name) {
  return page.locator(".dash-summary .dash-tile").filter({
    has: page.locator(".k", { hasText: new RegExp(`^${name}$`) }),
  });
}

async function periodoAtual(page) {
  return {
    mes: await page.locator('select[aria-label="Mês"]').inputValue(),
    ano: await page.locator('select[aria-label="Ano"]').inputValue(),
  };
}

// Clica perto do início do gráfico (não o ponto mais recente/atual — esse já
// é o mês corrente selecionado por padrão, então clicar nele não mudaria o
// filtro e o teste ficaria inconclusivo). Não precisa de precisão de pixel:
// o recharts resolve pro ponto mais próximo no eixo X dentro da área do
// gráfico. Usa mouse.move + wait + down/up em vez de locator.click() —
// achado real (diag-click.mjs): locator.click() não dava tempo pro recharts
// resolver o activeIndex via mousemove antes do click, então o clique
// "vazava" pro botão pai (abria o funil) sem disparar onSelecionarMes;
// mouse.move seguido de um pequeno wait resolve isso de forma confiável.
async function clickPontoAnterior(page, chartLocator) {
  const box = await chartLocator.boundingBox();
  if (!box) throw new Error("gráfico sem bounding box (não renderizou?)");
  const x = box.x + box.width * 0.15;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.mouse.up();
}

const consoleErrors = [];
const failures = [];

async function runSteps(page, label) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".dash-summary").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);

  // ---- Card Despesa: sparkline (variant="spark") clicável filtra o mês ----
  const despesaTile = tile(page, "Despesa");
  const despesaChart = despesaTile.locator(".spark .recharts-surface");
  await despesaChart.waitFor({ timeout: 10000 });

  const antes = await periodoAtual(page);
  await clickPontoAnterior(page, despesaChart);
  await page.waitForTimeout(400);
  const depois = await periodoAtual(page);
  if (antes.mes === depois.mes && antes.ano === depois.ano) {
    failures.push(
      `[${label}] clique no sparkline do card Despesa não mudou o filtro (antes=${antes.mes}/${antes.ano}, depois=${depois.mes}/${depois.ano})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s26-01-card-clique-filtro.png`),
    fullPage: true,
  });

  // ---- Hover no card Saldo mostra tooltip mês/ano + valor ----
  const saldoTile = tileExact(page, "Saldo");
  const saldoChart = saldoTile.locator(".spark .recharts-surface");
  await saldoChart.waitFor({ timeout: 10000 });
  // No viewport mobile o card Saldo fica abaixo da dobra — sem isso,
  // boundingBox() ainda retorna coordenadas válidas, mas fora da área
  // visível, e o mouse.move não "encontra" o elemento (achado real).
  await saldoChart.scrollIntoViewIfNeeded();
  const saldoBox = await saldoChart.boundingBox();
  await page.mouse.move(saldoBox.x + saldoBox.width * 0.3, saldoBox.y + saldoBox.height / 2);
  await page.waitForTimeout(150);
  await page.mouse.move(saldoBox.x + saldoBox.width * 0.5, saldoBox.y + saldoBox.height / 2);
  await page.waitForTimeout(400);
  // Escopado ao tile do Saldo — cada gráfico da página renderiza seu próprio
  // .recharts-tooltip-wrapper (visível só quando ativo); um seletor global
  // pegaria o wrapper de outro card (ex.: Receita), sempre oculto, e daria
  // falso negativo mesmo com o tooltip certo visível na tela.
  const tooltipVisible = await saldoTile
    .locator(".recharts-tooltip-wrapper")
    .first()
    .isVisible()
    .catch(() => false);
  if (!tooltipVisible) {
    failures.push(`[${label}] hover no card Saldo não mostrou tooltip`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s26-02-hover-tooltip.png`),
  });
  await page.mouse.move(0, 0);

  // ---- Funil Despesa: RowTrend reconstruído (3x mais largo, ~144px) ----
  await navButton(page, "Dashboards").click();
  await page.locator(".dash-summary").first().waitFor();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Despesa/ }).click();
  const primeiraLinha = page.locator(".dash-accordion .dash-row").first();
  await primeiraLinha.waitFor({ timeout: 10000 });
  const rowTrendSvg = primeiraLinha.locator(".trend svg").first();
  const temRowTrend = await rowTrendSvg.isVisible().catch(() => false);
  if (temRowTrend) {
    const largura = Number(await rowTrendSvg.getAttribute("width"));
    if (!largura || largura < 100) {
      failures.push(
        `[${label}] mini gráfico de linha do funil não está ~3x mais largo (largura=${largura})`
      );
    }
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s26-03-funil-rowtrend.png`),
    fullPage: true,
  });
  await page.getByRole("button", { name: /^Despesa/ }).click();

  // ---- Card Ativos: "Valor atual por Ativo" virou accordion, não tabela ----
  await tile(page, "Ativos").click();
  await page.getByText("Valor atual por Ativo").waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);

  const funilAtivos = page.locator(".dash-funnel");
  const secaoAtivo = funilAtivos.locator("h3", { hasText: "Valor atual por Ativo" });
  const listaAposAtivo = secaoAtivo.locator(
    "xpath=following-sibling::*[self::ul or self::div][1]"
  );
  const temTabela = (await listaAposAtivo.locator("table").count()) > 0;
  if (temTabela) {
    failures.push(`[${label}] "Valor atual por Ativo" ainda é tabela, não accordion`);
  }
  const linhaAtivo = listaAposAtivo.locator(".dash-row").first();
  const temLinhaExpansivel = await linhaAtivo.isVisible().catch(() => false);
  if (temLinhaExpansivel) {
    await linhaAtivo.click();
    await page.waitForTimeout(300);
    const painelExpandido = await page
      .locator(".dash-accordion-panel", { hasText: "Adquirido em" })
      .first()
      .isVisible()
      .catch(() => false);
    if (!painelExpandido) {
      failures.push(`[${label}] linha de "Valor atual por Ativo" não expande com tipo/data`);
    }
  } else {
    failures.push(`[${label}] "Valor atual por Ativo" sem nenhuma linha expansível (dash-row)`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s26-04-ativos-accordion.png`),
    fullPage: true,
  });
  await tile(page, "Ativos").click();

  // ---- Tela Investimentos: TrendChart (variant="card") do drilldown clicável ----
  await navButton(page, "Investimentos").click();
  await page.getByRole("heading", { name: "Investimentos", level: 2 }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  const verPosicoes = page.getByRole("button", { name: "Ver posições" }).first();
  if (await verPosicoes.isVisible().catch(() => false)) {
    await verPosicoes.click();
    await page.getByRole("button", { name: "Extrato" }).click();
    await page.waitForTimeout(400);
    const cardChart = page.locator(".dash-chart .recharts-surface").first();
    const temCardChart = await cardChart.isVisible().catch(() => false);
    if (temCardChart) {
      const antesInv = await periodoAtual(page);
      await clickPontoAnterior(page, cardChart);
      await page.waitForTimeout(400);
      const depoisInv = await periodoAtual(page);
      if (antesInv.mes === depoisInv.mes && antesInv.ano === depoisInv.ano) {
        failures.push(
          `[${label}] clique no TrendChart de Investimentos (drilldown) não mudou o filtro`
        );
      }
    }
    await page.screenshot({
      path: path.join(shotsDir, `${label}-s26-05-investimentos-trendchart.png`),
      fullPage: true,
    });
  }
}

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

  try {
    await runSteps(page, label);
  } catch (err) {
    failures.push(`[${label}] script falhou: ${err.message}`);
    try {
      await page.screenshot({ path: path.join(shotsDir, `${label}-s26-ERRO.png`), fullPage: true });
    } catch {
      // se nem o screenshot de erro funcionar, segue só com a mensagem já registrada.
    }
  }

  await context.close();
  console.log(`[${label}] done`);
}

const browser = await chromium.launch();
try {
  await run(browser, { width: 1440, height: 1000 }, "light", "desktop-claro");
  await run(browser, { width: 1440, height: 1000 }, "dark", "desktop-escuro");
  await run(browser, { width: 390, height: 844 }, "light", "mobile-claro");
  await run(browser, { width: 390, height: 844 }, "dark", "mobile-escuro");
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error("Falhas encontradas:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
if (consoleErrors.length > 0) {
  console.error("Erros de console encontrados:");
  for (const e of consoleErrors) console.error(" -", e);
  process.exit(1);
}
console.log("done, sem erros de console, sem falhas de asserção");
