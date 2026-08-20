// Validação ao vivo da Sprint 27: "ocultar gasto" (binóculo) por transação
// dentro do funil Despesa/Receita do Dashboard, recalculando total de
// grupo/subcategoria e mini gráfico local sem chamada de rede nova, sem
// afetar os cards de resumo do topo, e resetando ao fechar o funil ou trocar
// o filtro de mês; gráfico comparativo de categorias dentro do mesmo funil.
// Script só navega, clica em toggles client-side e lê dado real — nada aqui
// grava no backend (a própria feature é 100% local/efêmera), então não há
// nenhuma mutação de dado real do CEO pra desfazer ao final.

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

function tileExact(page, name) {
  return page.locator(".dash-summary .dash-tile").filter({
    has: page.locator(".k", { hasText: new RegExp(`^${name}$`) }),
  });
}

const consoleErrors = [];
const failures = [];

async function runSteps(page, label) {
  let networkCalls = 0;
  page.on("request", (req) => {
    if (/\/dashboards|\/pluggy/.test(req.url())) networkCalls += 1;
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".dash-summary").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);

  const despesaTile = tileExact(page, "Despesa");
  const saldoTile = tileExact(page, "Saldo");
  const ativosTile = tileExact(page, "Ativos");
  const passivosTile = tileExact(page, "Passivos");
  const patrimonioTile = tileExact(page, "Patrimônio");
  const despesaAntesAbrir = (await despesaTile.locator(".v").innerText()).trim();
  const saldoAntesAbrir = (await saldoTile.locator(".v").innerText()).trim();
  const ativosAntes = (await ativosTile.locator(".v").innerText()).trim();
  const passivosAntes = (await passivosTile.locator(".v").innerText()).trim();
  const patrimonioAntes = (await patrimonioTile.locator(".v").innerText()).trim();

  // ---- Abrir funil Despesa: gráfico comparativo aparece ----
  await despesaTile.click();
  const funil = page.locator(".dash-funnel");
  await funil.locator(".dash-accordion > li .dash-row").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);

  const temComparativo = await page
    .getByText("Comparativo por categoria")
    .isVisible()
    .catch(() => false);
  if (!temComparativo) {
    failures.push(`[${label}] gráfico "Comparativo por categoria" não apareceu ao abrir o funil`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s27-01-funil-despesa-comparativo.png`),
    fullPage: true,
  });

  // ---- Expandir maior grupo -> maior subcategoria -> lista de transações ----
  const grupoRow = funil.locator(".dash-accordion > li .dash-row").first();
  const grupoAntes = (await grupoRow.locator(".amt").innerText()).trim();
  await grupoRow.click();

  const subRow = funil.locator(".dash-accordion-panel .dash-accordion > li .dash-row").first();
  await subRow.waitFor({ timeout: 10000 });
  const subAntes = (await subRow.locator(".amt").innerText()).trim();
  await subRow.click();

  const primeiraLinha = funil.locator(".txn-table tbody tr").first();
  await primeiraLinha.waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);

  const bannerAntes = await page
    .locator(".dash-hidden-summary")
    .isVisible()
    .catch(() => false);
  if (bannerAntes) {
    failures.push(`[${label}] aviso de simulação já aparece antes de ocultar qualquer item`);
  }

  // ---- Ocultar a 1ª transação: total de grupo/subcategoria recalcula, sem rede nova ----
  const toggle = primeiraLinha.locator(".hide-toggle");
  await toggle.waitFor({ timeout: 10000 });
  const callsAntes = networkCalls;
  await toggle.click();
  await page.waitForTimeout(400);

  const bannerDepois = await page.locator(".dash-hidden-summary").innerText().catch(() => "");
  if (!bannerDepois.includes("Simulando sem 1")) {
    failures.push(`[${label}] aviso de simulação não apareceu após ocultar (texto: "${bannerDepois}")`);
  }
  if (networkCalls !== callsAntes) {
    failures.push(
      `[${label}] ocultar gasto disparou chamada(s) de rede nova (${callsAntes} -> ${networkCalls})`
    );
  }

  const subDepois = (await subRow.locator(".amt").innerText()).trim();
  const grupoDepois = (await grupoRow.locator(".amt").innerText()).trim();
  if (subDepois === subAntes) {
    failures.push(`[${label}] total da subcategoria não mudou ao ocultar (${subAntes})`);
  }
  if (grupoDepois === grupoAntes) {
    failures.push(`[${label}] total do grupo não mudou ao ocultar (${grupoAntes})`);
  }

  // Despesa/Saldo do topo recalculam com o item oculto (pedido do CEO ao
  // vivo durante a execução); Ativos/Passivos/Patrimônio, que não vêm do
  // mesmo período filtrado, ficam intocados.
  const despesaDepoisOcultar = (await despesaTile.locator(".v").innerText()).trim();
  const saldoDepoisOcultar = (await saldoTile.locator(".v").innerText()).trim();
  if (despesaDepoisOcultar === despesaAntesAbrir) {
    failures.push(`[${label}] card "Despesa" do topo não mudou ao ocultar item (${despesaAntesAbrir})`);
  }
  if (saldoDepoisOcultar === saldoAntesAbrir) {
    failures.push(`[${label}] card "Saldo" do topo não mudou ao ocultar item (${saldoAntesAbrir})`);
  }
  const ativosDepois = (await ativosTile.locator(".v").innerText()).trim();
  const passivosDepois = (await passivosTile.locator(".v").innerText()).trim();
  const patrimonioDepois = (await patrimonioTile.locator(".v").innerText()).trim();
  if (ativosDepois !== ativosAntes) {
    failures.push(`[${label}] card "Ativos" mudou ao ocultar item (${ativosAntes} -> ${ativosDepois})`);
  }
  if (passivosDepois !== passivosAntes) {
    failures.push(
      `[${label}] card "Passivos" mudou ao ocultar item (${passivosAntes} -> ${passivosDepois})`
    );
  }
  if (patrimonioDepois !== patrimonioAntes) {
    failures.push(
      `[${label}] card "Patrimônio" mudou ao ocultar item (${patrimonioAntes} -> ${patrimonioDepois})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s27-02-item-ocultado.png`),
    fullPage: true,
  });

  // ---- Restaurar: totais voltam ao valor original ----
  await page.getByRole("button", { name: "Restaurar" }).click();
  await page.waitForTimeout(300);
  const bannerAposRestaurar = await page
    .locator(".dash-hidden-summary")
    .isVisible()
    .catch(() => false);
  if (bannerAposRestaurar) {
    failures.push(`[${label}] aviso de simulação continua visível após "Restaurar"`);
  }
  const subRestaurado = (await subRow.locator(".amt").innerText()).trim();
  const grupoRestaurado = (await grupoRow.locator(".amt").innerText()).trim();
  const despesaRestaurada = (await despesaTile.locator(".v").innerText()).trim();
  if (despesaRestaurada !== despesaAntesAbrir) {
    failures.push(
      `[${label}] card "Despesa" não voltou ao original após "Restaurar" (${despesaAntesAbrir} -> ${despesaRestaurada})`
    );
  }
  if (subRestaurado !== subAntes || grupoRestaurado !== grupoAntes) {
    failures.push(
      `[${label}] totais não voltaram ao original após "Restaurar" (sub: ${subAntes} -> ${subRestaurado}, grupo: ${grupoAntes} -> ${grupoRestaurado})`
    );
  }

  // ---- Ocultar de novo, fechar o funil e reabrir: reset automático ----
  await toggle.click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Fechar" }).click();
  await despesaTile.click();
  await funil.locator(".dash-accordion > li .dash-row").first().waitFor({ timeout: 10000 });
  const bannerAposFechar = await page
    .locator(".dash-hidden-summary")
    .isVisible()
    .catch(() => false);
  if (bannerAposFechar) {
    failures.push(`[${label}] aviso de simulação sobrevive ao fechar/reabrir o funil`);
  }
  const despesaAposFechar = (await despesaTile.locator(".v").innerText()).trim();
  if (despesaAposFechar !== despesaAntesAbrir) {
    failures.push(
      `[${label}] card "Despesa" não voltou ao original após fechar/reabrir (${despesaAntesAbrir} -> ${despesaAposFechar})`
    );
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s27-03-reset-apos-fechar.png`),
    fullPage: true,
  });

  // ---- Ocultar de novo e trocar o mês: reset automático sem fechar o funil ----
  await grupoRow.click();
  await subRow.waitFor({ timeout: 10000 });
  await subRow.click();
  const linha2 = funil.locator(".txn-table tbody tr").first();
  await linha2.waitFor({ timeout: 10000 });
  await linha2.locator(".hide-toggle").click();
  await page.waitForTimeout(300);
  const bannerAntesTrocarMes = await page
    .locator(".dash-hidden-summary")
    .isVisible()
    .catch(() => false);
  if (!bannerAntesTrocarMes) {
    failures.push(`[${label}] aviso de simulação não apareceu na 2ª rodada de ocultar`);
  }

  const mesAtual = await page.getByLabel("Mês").inputValue();
  const outroMes = mesAtual === "1" ? "2" : "1";
  await page.getByLabel("Mês").selectOption(outroMes);
  await page.waitForTimeout(500);
  const bannerAposTrocarMes = await page
    .locator(".dash-hidden-summary")
    .isVisible()
    .catch(() => false);
  if (bannerAposTrocarMes) {
    failures.push(`[${label}] aviso de simulação sobrevive à troca de mês`);
  }
  await page.screenshot({
    path: path.join(shotsDir, `${label}-s27-04-reset-apos-trocar-mes.png`),
    fullPage: true,
  });
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
      await page.screenshot({ path: path.join(shotsDir, `${label}-s27-ERRO.png`), fullPage: true });
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
