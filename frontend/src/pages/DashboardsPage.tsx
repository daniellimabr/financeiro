/**
 * DIRECTION CONTRACT — Sprint 5 / Impeccable new-work (extended Sprint 6, refined Sprint 9)
 *
 * THESIS: personal finance dashboards default to "hero card + neutral SaaS
 * chrome" that summarizes and stops; this page instead makes despesa/receita
 * a bodily read (green/terracotta) instead of a labeled abstraction, and
 * treats every total as an honest entry point — nothing here is a dead end,
 * everything is one click from the transaction that produced it.
 * OWN-WORLD: warm-neutral surface (#f5f6f1 light / #18181b dark), one brand
 * accent (green, shared with the "receita" semantic), terracotta reserved
 * only for despesa — never used as chrome. Archivo/Public Sans pair (Sprint
 * 6, chosen by the CEO via rendered comparison artifact), tabular numerals,
 * 12px-radius cards, no icon+heading+text card scaffolding.
 * STORY: user already knows the month; sees six totals at a glance (Receita/
 * Despesa/Saldo/Ativos/Passivos/Patrimônio), each with a sparkline of recent
 * history (Patrimônio marked "atual" so it never reads as period-scoped,
 * explicitly flagged as having no history yet); clicks the number they're
 * curious about and expands a funnel — categoria (or ativo/passivo/conta)
 * expands straight into the transaction list, one level deep, each row
 * carrying a small icon for its meio de pagamento instead of an extra click.
 * FIRST VIEWPORT: filtro ano/mês + seletor de histórico top-left, six
 * summary tiles in a grid immediately below, Despesa/Receita/Saldo/Ativos/
 * Passivos tiles visibly interactive, Patrimônio tile carries an "atual"
 * tag, no hero, no chart above the fold.
 * FORM: direction D (YNAB/Copilot-esque) from the Sprint 5 direction round —
 * confirmed by the user via published comparison artifacts, dark mode
 * adjusted to neutral charcoal per feedback (terracotta stays an accent,
 * never the background).
 * FINISH: unreviewed and undocumented is unfinished; this build ends with
 * the finish review, the verdict, and DESIGN.md.
 */
import { useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  type CategoriaTotal,
  type OrcamentoStatus,
  type PeriodoHistorico,
  type PontoTendencia,
  type Regime,
  type TendenciaMes,
  type TransacaoTipo,
} from "../api/dashboards";
import type { PluggyInvestment } from "../api/pluggy";
import { CategoriaComparativoChart } from "../components/CategoriaComparativoChart";
import { chartCursorProps, ChartTooltip } from "../components/ChartTooltip";
import { KpiTile } from "../components/KpiTile";
import type { KpiDelta } from "../components/KpiTile";
import { RegimeToggle } from "../components/RegimeToggle";
import { TransactionsTable } from "../components/TransactionsTable";
import { TrendLineChart } from "../components/TrendLineChart";
import { useAssets } from "../hooks/useAssets";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useDashboardByCategoria } from "../hooks/useDashboardByCategoria";
import { useDashboardCategoriaTendencia } from "../hooks/useDashboardCategoriaTendencia";
import { useDashboardPorOrcamento } from "../hooks/useDashboardPorOrcamento";
import { useDashboardSaldoAcumulado } from "../hooks/useDashboardSaldoAcumulado";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { useDashboardTendencia } from "../hooks/useDashboardTendencia";
import { useInvestimentos } from "../hooks/useInvestimentos";
import { useLiabilities } from "../hooks/useLiabilities";
import { useLiabilityGastos } from "../hooks/useLiabilityGastos";
import { usePatrimonioBreakdown } from "../hooks/usePatrimonioBreakdown";
import { usePluggyInvestments } from "../hooks/usePluggyInvestments";
import { useSaldoAcumuladoConferencia } from "../hooks/useSaldoAcumuladoConferencia";
import { useSaldoPorConta } from "../hooks/useSaldoPorConta";
import { useSubcategories } from "../hooks/useSubcategories";
import {
  buildColorIndexFromIds,
  buildSubcategoryTintIndex,
  groupColorVar,
  subcategoryColorVar,
} from "../utils/categoryColors";
import { formatCurrency } from "../utils/format";
import { computeSharedDomain } from "../utils/sharedChartDomain";

const ASSET_TIPO_LABEL: Record<string, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  outro: "Outro",
};

function formatPercent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}

interface PeriodoFiltro {
  ano: number;
  mes: number;
}

type DrillKind =
  "receita" | "despesa" | "ativos" | "passivos" | "saldo" | "patrimonio" | "saldoAcumulado";

function toggleId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((existing) => existing !== id) : [...list, id];
}

// Rollover de ano incluído — dezembro do ano anterior é um "mês anterior"
// válido para todo filtro exceto jan/2026 (início do registro histórico,
// tratado à parte no clique do card "Saldo Anterior").
function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

// Inverso de mesAnterior — navegação pro mês seguinte no card "Saldo
// Acumulado" (fronteira tratada à parte no clique: não navega pro mês
// corrente real em diante, mesmo alerta que mesAnterior usa pra jan/2026).
function mesSeguinte(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

interface DrillState {
  kind: DrillKind;
  // ids das linhas expandidas na seção atualmente aberta — usado por
  // ativos/passivos (asset_id/liability_id, um único nível).
  expandedRows: number[];
  // usados só por receita/despesa, que tem dois níveis de agrupamento:
  // Categoria (group_id) e, dentro dela, Tipo (subcategory_id).
  expandedGrupos: number[];
  expandedSubcategorias: number[];
}

export function DashboardsPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [periodoHistorico, setPeriodoHistorico] = useState<PeriodoHistorico>(6);
  const [regime, setRegime] = useState<Regime>("competencia");
  const [drill, setDrill] = useState<DrillState | null>(null);

  const filter: PeriodoFiltro = { ano, mes };

  const summaryQuery = useDashboardSummary({ ...filter, regime });
  const tendenciaQuery = useDashboardTendencia(ano, mes, periodoHistorico, regime);
  const saldoAcumuladoQuery = useDashboardSaldoAcumulado(ano, mes, periodoHistorico);

  // "Ocultar gasto" (Sprint 27, PRD-027) — estado 100% local/efêmero, mesmo
  // padrão de applyHipoteticas (Sprint 14). Vive aqui (não dentro de
  // GrupoAccordion) porque o CEO pediu, ao ver o resultado ao vivo, que os
  // cards Receita/Despesa/Saldo do topo também reflitam a simulação — só
  // esses 3 são derivados diretamente do período filtrado (soma/subtração
  // simples); Patrimônio e Saldo Acumulado vêm de fórmulas sem relação
  // direta com "ocultar uma linha de gasto do mês" e continuam intocados
  // (decisão confirmada explicitamente ao reabrir o escopo original do
  // PRD-027 durante a execução).
  const [hiddenTxns, setHiddenTxns] = useState<
    Map<number, { subcategoryId: number; valor: number }>
  >(new Map());
  // Reset ao trocar ano/mês via ajuste de estado durante a renderização
  // (padrão recomendado pelo React pra "resetar estado quando uma prop
  // muda") em vez de useEffect — evita o re-render em cascata de um
  // setState síncrono dentro de efeito (react-hooks/set-state-in-effect).
  const [ultimoFiltro, setUltimoFiltro] = useState({ ano, mes });
  if (ultimoFiltro.ano !== ano || ultimoFiltro.mes !== mes) {
    setUltimoFiltro({ ano, mes });
    setHiddenTxns(new Map());
  }

  function toggleHidden(subcategoryId: number, transactionId: number, valor: number) {
    setHiddenTxns((prev) => {
      const next = new Map(prev);
      if (next.has(transactionId)) next.delete(transactionId);
      else next.set(transactionId, { subcategoryId, valor: Math.abs(valor) });
      return next;
    });
  }

  const hiddenIds = useMemo(() => new Set(hiddenTxns.keys()), [hiddenTxns]);

  const hiddenSumBySubcategoria = useMemo(() => {
    const map = new Map<number, number>();
    for (const { subcategoryId, valor } of hiddenTxns.values()) {
      map.set(subcategoryId, (map.get(subcategoryId) ?? 0) + valor);
    }
    return map;
  }, [hiddenTxns]);

  const hiddenSumTotal = useMemo(
    () => [...hiddenTxns.values()].reduce((sum, h) => sum + h.valor, 0),
    [hiddenTxns]
  );

  // Só aplica a simulação ao card cujo funil está aberto — hiddenTxns só tem
  // itens de despesa OU receita por vez (reseta ao trocar de funil, ver
  // abrirFunil/fecharFunil abaixo), nunca os dois ao mesmo tempo.
  const hiddenAplicaA = drill?.kind === "despesa" || drill?.kind === "receita" ? drill.kind : null;
  const despesaAjustada =
    summaryQuery.data &&
    String(Number(summaryQuery.data.despesa) - (hiddenAplicaA === "despesa" ? hiddenSumTotal : 0));
  const receitaAjustada =
    summaryQuery.data &&
    String(Number(summaryQuery.data.receita) - (hiddenAplicaA === "receita" ? hiddenSumTotal : 0));
  // Saldo = Receita − Despesa: ocultar uma despesa aumenta o saldo, ocultar
  // uma receita diminui — sinal oposto ao aplicado nos 2 cards acima.
  const saldoAjustado =
    summaryQuery.data &&
    String(
      Number(summaryQuery.data.saldo) +
        (hiddenAplicaA === "despesa"
          ? hiddenSumTotal
          : hiddenAplicaA === "receita"
            ? -hiddenSumTotal
            : 0)
    );

  // A série vem com um ponto a mais no início (ver useDashboardSaldoAcumulado)
  // — esse ponto extra é só o valor do "mês anterior", usado pelo card
  // "Saldo Anterior"; o restante (mesmo tamanho de periodoHistorico) alimenta
  // o card "Saldo Acumulado" e seu drill-down, igual às outras tendências.
  const saldoAcumuladoSerie = saldoAcumuladoQuery.data ?? [];
  const saldoAcumuladoAtual = saldoAcumuladoSerie.at(-1);
  const saldoAnterior = saldoAcumuladoSerie.length >= 2 ? saldoAcumuladoSerie.at(-2) : undefined;
  const saldoAcumuladoSparkline =
    saldoAcumuladoSerie.length > 1 ? saldoAcumuladoSerie.slice(1) : undefined;

  function abrirFunil(kind: DrillKind) {
    setDrill((prev) =>
      prev?.kind === kind
        ? null
        : { kind, expandedRows: [], expandedGrupos: [], expandedSubcategorias: [] }
    );
    setHiddenTxns(new Map());
  }

  function fecharFunil() {
    setDrill(null);
    setHiddenTxns(new Map());
  }

  function toggleRow(id: number) {
    setDrill((prev) => (prev ? { ...prev, expandedRows: toggleId(prev.expandedRows, id) } : prev));
  }

  function toggleGrupo(id: number) {
    setDrill((prev) =>
      prev ? { ...prev, expandedGrupos: toggleId(prev.expandedGrupos, id) } : prev
    );
  }

  function toggleSubcategoria(id: number) {
    setDrill((prev) =>
      prev ? { ...prev, expandedSubcategorias: toggleId(prev.expandedSubcategorias, id) } : prev
    );
  }

  const drillTitle: Record<DrillKind, string> = {
    receita: "Receita",
    despesa: "Despesa",
    ativos: "Ativos",
    passivos: "Passivos",
    saldo: "Saldo",
    patrimonio: "Patrimônio",
    saldoAcumulado: "Saldo Acumulado",
  };

  // Clique num ponto de qualquer gráfico de linha (card, mini gráfico de
  // linha do funil, TrendChart de drilldown) filtra a tela por aquele
  // mês/ano — mesmo padrão de navegação por clique já usado nos cards
  // "Saldo Anterior"/"Saldo Acumulado" desde a Sprint 15/24.
  function selecionarMes(ponto: { ano: number; mes: number }) {
    setAno(ponto.ano);
    setMes(ponto.mes);
  }

  function clicarSaldoAnterior() {
    if (ano === 2026 && mes === 1) {
      window.alert(
        "Início do registro histórico — não há dado de saldo acumulado antes de janeiro/2026."
      );
      return;
    }
    const anterior = mesAnterior(ano, mes);
    setAno(anterior.ano);
    setMes(anterior.mes);
  }

  function clicarSaldoAcumuladoSeguinte(event: MouseEvent) {
    event.stopPropagation();
    const hoje = new Date();
    if (ano === hoje.getFullYear() && mes === hoje.getMonth() + 1) {
      window.alert("Já está no mês corrente — não há mês seguinte para navegar.");
      return;
    }
    const seguinte = mesSeguinte(ano, mes);
    setAno(seguinte.ano);
    setMes(seguinte.mes);
  }

  function teclaSaldoAcumulado(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      abrirFunil("saldoAcumulado");
    }
  }

  const tendenciaAtual = tendenciaQuery.data?.at(-1);
  const tendenciaAnterior =
    tendenciaQuery.data && tendenciaQuery.data.length >= 2 ? tendenciaQuery.data.at(-2) : undefined;

  function buildDelta(campo: "receita" | "despesa", positiveIsGood: boolean): KpiDelta | undefined {
    if (!tendenciaAtual || !tendenciaAnterior) return undefined;
    return {
      mode: "percent",
      current: Number(tendenciaAtual[campo]),
      previous: Number(tendenciaAnterior[campo]),
      positiveIsGood,
    };
  }

  const receitaDelta = buildDelta("receita", true);
  const despesaDelta = buildDelta("despesa", false);
  const saldoAcumuladoDelta: KpiDelta | undefined =
    saldoAcumuladoAtual && saldoAnterior
      ? {
          mode: "percent",
          current: Number(saldoAcumuladoAtual.total),
          previous: Number(saldoAnterior.total),
          positiveIsGood: true,
        }
      : undefined;

  return (
    <section className="ac-page">
      <div className="ac-toolbar">
        <div className="ac-toolbar-left">
          <MonthNav
            ano={ano}
            mes={mes}
            onChange={(next) => {
              setAno(next.ano);
              setMes(next.mes);
            }}
          />
          <select
            className="ac-select"
            aria-label="Período histórico"
            value={periodoHistorico}
            onChange={(event) =>
              setPeriodoHistorico(Number(event.target.value) as PeriodoHistorico)
            }
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
          <RegimeToggle value={regime} onChange={setRegime} variant="ac" />
        </div>
      </div>

      {summaryQuery.isLoading && <p>Carregando...</p>}
      {summaryQuery.isError && <p role="alert">Não foi possível carregar o resumo.</p>}

      {summaryQuery.data && (
        <>
          <div className="ac-section-label">Fluxo do mês</div>
          <div className="ac-kpi-row">
            <KpiTile
              label="Saldo Anterior"
              value={saldoAnterior ? formatCurrency(saldoAnterior.total) : "—"}
              caption={
                saldoAnterior
                  ? `${String(saldoAnterior.mes).padStart(2, "0")}/${saldoAnterior.ano}`
                  : undefined
              }
              onClick={clicarSaldoAnterior}
            />
            <KpiTile
              label="Receita"
              value={formatCurrency(receitaAjustada)}
              delta={receitaDelta}
              onClick={() => abrirFunil("receita")}
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={applyHiddenToTrend(
                    tendenciaQuery.data?.map((p) => ({
                      ano: p.ano,
                      mes: p.mes,
                      total: p.receita,
                    })),
                    ano,
                    mes,
                    hiddenAplicaA === "receita" ? hiddenSumTotal : 0
                  )}
                  color="var(--ac-good)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
            <KpiTile
              label="Despesa"
              value={formatCurrency(despesaAjustada)}
              delta={despesaDelta}
              onClick={() => abrirFunil("despesa")}
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={applyHiddenToTrend(
                    tendenciaQuery.data?.map((p) => ({
                      ano: p.ano,
                      mes: p.mes,
                      total: p.despesa,
                    })),
                    ano,
                    mes,
                    hiddenAplicaA === "despesa" ? hiddenSumTotal : 0
                  )}
                  color="var(--ac-bad)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
            <KpiTile
              label="Saldo"
              value={formatCurrency(saldoAjustado)}
              delta={{
                mode: "flat",
                label: "fluxo",
                title: "fluxo do mês, não é o saldo bancário",
              }}
              onClick={() => abrirFunil("saldo")}
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={applyHiddenToTrend(
                    tendenciaQuery.data?.map((p) => ({ ano: p.ano, mes: p.mes, total: p.saldo })),
                    ano,
                    mes,
                    hiddenAplicaA === "despesa"
                      ? -hiddenSumTotal
                      : hiddenAplicaA === "receita"
                        ? hiddenSumTotal
                        : 0
                  )}
                  color="var(--ac-text-h)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
            <KpiTile
              label="Saldo Acumulado"
              value={saldoAcumuladoAtual ? formatCurrency(saldoAcumuladoAtual.total) : "—"}
              valueVariant="accent"
              delta={saldoAcumuladoDelta}
              badge={{ label: "saldo real" }}
              ariaLabel={`Saldo Acumulado ${
                saldoAcumuladoAtual ? formatCurrency(saldoAcumuladoAtual.total) : "—"
              }`}
              onClick={() => abrirFunil("saldoAcumulado")}
              onKeyDown={teclaSaldoAcumulado}
              labelExtra={
                <button
                  type="button"
                  className="ac-kpi-arrow"
                  aria-label="Ver mês seguinte"
                  onClick={clicarSaldoAcumuladoSeguinte}
                >
                  <ArrowIcon direction="right" />
                </button>
              }
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={saldoAcumuladoSparkline}
                  color="var(--ac-blue)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
          </div>

          <div className="ac-section-label">Patrimônio</div>
          <div className="ac-kpi-row--compact">
            <KpiTile
              compact
              label="Ativos"
              value={formatCurrency(summaryQuery.data.ativos_totais)}
              onClick={() => abrirFunil("ativos")}
            />
            <KpiTile
              compact
              label="Passivos"
              value={formatCurrency(summaryQuery.data.passivos)}
              onClick={() => abrirFunil("passivos")}
            />
            <KpiTile
              compact
              label="Patrimônio"
              value={formatCurrency(summaryQuery.data.patrimonio)}
              onClick={() => abrirFunil("patrimonio")}
            />
          </div>
        </>
      )}

      <div className="ac-panel">
        <div className="ac-panel-head">
          <div>
            <h2>Conciliação — Saldo acumulado por conta</h2>
            <div className="ac-panel-meta">
              Saldo real de cada conta corrente ao fim do mês, comparado ao extrato bancário — a
              ferramenta usada para bater as contas ao centavo.
            </div>
          </div>
        </div>
        <SaldoAcumuladoConferenciaTable ano={ano} mes={mes} />
      </div>

      {tendenciaQuery.data && tendenciaQuery.data.length > 1 && (
        <ReceitaDespesaComparativo
          pontos={tendenciaQuery.data}
          periodoHistorico={periodoHistorico}
        />
      )}

      {drill && (
        <div className="dash-funnel">
          <div className="dash-funnel-head">
            <h2>{drillTitle[drill.kind]}</h2>
            <button type="button" className="dash-back" onClick={fecharFunil}>
              Fechar
            </button>
          </div>

          {(drill.kind === "receita" || drill.kind === "despesa") && (
            <GrupoAccordion
              tipo={drill.kind === "receita" ? "credito" : "debito"}
              filter={filter}
              periodoHistorico={periodoHistorico}
              regime={regime}
              expandedGrupos={drill.expandedGrupos}
              expandedSubcategorias={drill.expandedSubcategorias}
              onToggleGrupo={toggleGrupo}
              onToggleSubcategoria={toggleSubcategoria}
              onSelecionarMes={selecionarMes}
              hiddenCount={hiddenTxns.size}
              hiddenIds={hiddenIds}
              hiddenSumBySubcategoria={hiddenSumBySubcategoria}
              onToggleHidden={toggleHidden}
              onRestaurarTudo={() => setHiddenTxns(new Map())}
            />
          )}

          {drill.kind === "ativos" && (
            <>
              <h3>Valor atual por Ativo</h3>
              <AssetsValorAtualList />
              <h3>Valor atual por Investimento</h3>
              <InvestimentosValorAtualList />
              <h3>Saldo por Conta Corrente</h3>
              <SaldoContaCorrenteList />
            </>
          )}

          {drill.kind === "passivos" && (
            <>
              <PassivosAccordion
                filter={filter}
                regime={regime}
                expandedRows={drill.expandedRows}
                onToggleRow={toggleRow}
              />
              <h3>Passivos — saldo devedor</h3>
              <LiabilitiesValorAtualList />
            </>
          )}

          {drill.kind === "saldo" && summaryQuery.data && (
            <SaldoMemoriaCalculo
              receita={summaryQuery.data.receita}
              despesa={summaryQuery.data.despesa}
              saldo={summaryQuery.data.saldo}
            />
          )}

          {drill.kind === "patrimonio" && (
            <PatrimonioBreakdownPanel
              regime={regime}
              saldoAcumuladoSparkline={saldoAcumuladoSparkline}
              onSelecionarMes={selecionarMes}
            />
          )}

          {drill.kind === "saldoAcumulado" && (
            <>
              <p className="dash-empty">
                Saldo real das contas corrente com "Saldo inicial" configurado (ver Configurações),
                menos o salário recebido no mês (competência do mês seguinte, mesmo já estando na
                conta) — não depende do toggle Competência/Caixa acima. Pra ver o saldo bancário
                bruto por conta, use o card "Saldo". A tabela de conferência por conta está sempre
                visível no painel "Conciliação" acima, fora deste funil.
              </p>
              {saldoAcumuladoSparkline && saldoAcumuladoSparkline.length > 0 ? (
                <TrendLineChart
                  variant="card"
                  pontos={saldoAcumuladoSparkline}
                  color="var(--accent)"
                  onSelecionarMes={selecionarMes}
                />
              ) : (
                <p className="dash-empty">Nenhuma conta com saldo inicial informado.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

// Seta decorativa dos cards "Saldo Anterior"/"Saldo Acumulado" — mesmo
// padrão de ícone SVG inline de AccountTipoIcon.tsx (viewBox 16x16, stroke
// currentColor), só com um path por direção em vez de um mapa por tipo.
function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M10 2.5 4 8l6 5.5M4 8h8" : "M6 2.5 12 8l-6 5.5M12 8H4";
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const MESES_COMPLETOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function isMesAtual(ano: number, mes: number): boolean {
  const hoje = new Date();
  return ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
}

// Navegador de mês (◀ mês ▶) da toolbar (Sprint 34) — substitui o filtro
// ano/mês simples (PeriodFilter, que continua servindo as outras 8 telas).
// Reaproveita mesAnterior/mesSeguinte já usados pelos cards Saldo Anterior/
// Saldo Acumulado, mesma regra de fronteira: nunca avança além do mês
// corrente real (botão "próximo" desabilitado, não só um alerta).
function MonthNav({
  ano,
  mes,
  onChange,
}: {
  ano: number;
  mes: number;
  onChange: (proximo: { ano: number; mes: number }) => void;
}) {
  return (
    <div className="ac-month-nav" role="group" aria-label="Navegar entre meses">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(mesAnterior(ano, mes))}
      >
        <ArrowIcon direction="left" />
      </button>
      <span className="current">
        {MESES_COMPLETOS[mes - 1]} {ano}
      </span>
      <button
        type="button"
        aria-label="Próximo mês"
        disabled={isMesAtual(ano, mes)}
        onClick={() => onChange(mesSeguinte(ano, mes))}
      >
        <ArrowIcon direction="right" />
      </button>
    </div>
  );
}

// Comparativo Receita vs. Despesa em pequenos múltiplos (Sprint 34) — duas
// séries com o MESMO domínio Y (computeSharedDomain sobre as duas juntas,
// nunca cada uma normalizada no seu próprio mínimo/máximo — comparação
// visual real, não só formato). Tooltip/crosshair via ChartTooltip.tsx.
function ReceitaDespesaComparativo({
  pontos,
  periodoHistorico,
}: {
  pontos: TendenciaMes[];
  periodoHistorico: PeriodoHistorico;
}) {
  const receitaData = pontos.map((p) => ({
    label: `${String(p.mes).padStart(2, "0")}/${p.ano}`,
    ano: p.ano,
    mes: p.mes,
    total: Number(p.receita),
  }));
  const despesaData = pontos.map((p) => ({
    label: `${String(p.mes).padStart(2, "0")}/${p.ano}`,
    ano: p.ano,
    mes: p.mes,
    total: Number(p.despesa),
  }));
  const domain = computeSharedDomain([
    receitaData.map((d) => d.total),
    despesaData.map((d) => d.total),
  ]);

  return (
    <div className="ac-panel">
      <div className="ac-panel-head">
        <div>
          <h2>Receita vs. despesa — {periodoHistorico} meses</h2>
          <div className="ac-panel-meta">
            Duas séries na mesma escala, sem eixo duplo. Passe o mouse pra ver cada mês.
          </div>
        </div>
      </div>
      <div className="ac-sm-grid">
        <div>
          <div className="ac-sm-chart-label">Receita</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={receitaData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <XAxis dataKey="label" hide />
              <YAxis domain={domain} hide />
              <Tooltip content={<ChartTooltip />} cursor={chartCursorProps} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--ac-good)"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="ac-sm-chart-label">Despesa</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={despesaData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <XAxis dataKey="label" hide />
              <YAxis domain={domain} hide />
              <Tooltip content={<ChartTooltip />} cursor={chartCursorProps} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--ac-bad)"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Card "Saldo": memória de cálculo (Receita − Despesa = Saldo do período
// filtrado) no lugar da lista de contas (snapshot bancário desalinhado do
// que o card representa — a lista continua acessível via card Ativos).
function SaldoMemoriaCalculo({
  receita,
  despesa,
  saldo,
}: {
  receita: string;
  despesa: string;
  saldo: string;
}) {
  return (
    <div className="dash-memoria-calculo">
      <p>
        <span style={{ color: "var(--receita)" }}>Receita {formatCurrency(receita)}</span>
        {" − "}
        <span style={{ color: "var(--despesa)" }}>Despesa {formatCurrency(despesa)}</span>
        {" = "}
        <strong>Saldo {formatCurrency(saldo)}</strong>
      </p>
    </div>
  );
}

// Tabela de conferência do drill-down do Saldo Acumulado (PRD-032, Sprint
// 32) — Total (100%) + uma linha por conta corrente, sempre visível (sem
// acordeão, pedido explícito do CEO). Reaproveita o idioma unificado
// .dash-table e o padrão "grouped table" (SubcategoryGroupTable, Sprint 30):
// borda separando a linha Total da lista de contas.
function SaldoAcumuladoConferenciaTable({ ano, mes }: { ano: number; mes: number }) {
  const query = useSaldoAcumuladoConferencia(ano, mes);

  if (query.isLoading) return <p>Carregando memória de cálculo...</p>;
  if (query.isError) {
    return <p role="alert">Não foi possível carregar a memória de cálculo.</p>;
  }

  const linhas = query.data ?? [];
  if (linhas.length === 0) {
    return <p className="dash-empty">Nenhuma conta corrente com saldo inicial informado.</p>;
  }

  return (
    <div className="ac-table-wrap">
      <table className="ac-table">
        <colgroup>
          <col style={{ width: "19%" }} />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Conta</th>
            <th>Saldo início</th>
            <th>Receitas</th>
            <th>Despesas</th>
            <th>Saldo fim do mês</th>
            <th>Salário recebido</th>
            <th>Saldo efetivo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, index) => (
            <tr
              key={linha.account_id ?? "total"}
              className={index === 0 ? "total" : index === 1 ? "acct acct-start" : "acct"}
            >
              <td>{linha.account_nome}</td>
              <td>{formatCurrency(linha.saldo_inicio)}</td>
              <td>{formatCurrency(linha.receitas)}</td>
              <td>{formatCurrency(linha.despesas)}</td>
              <td>{formatCurrency(linha.saldo_fim)}</td>
              <td>{formatCurrency(linha.salario_recebido)}</td>
              <td>{formatCurrency(linha.saldo_efetivo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// "Ocultar gasto" (Sprint 27) — desconta a soma dos itens marcados como
// ocultos só do ponto do mês/ano atualmente filtrado; os demais meses do
// histórico não mudam (simulação escopada ao mês aberto no funil, não
// retroativa). Sem efeito se hiddenSum é 0 (early return preserva a
// referência do array, evita recomputar tudo abaixo à toa).
function applyHiddenToTrend(
  trend: PontoTendencia[] | undefined,
  ano: number,
  mes: number,
  hiddenSum: number
): PontoTendencia[] | undefined {
  if (!trend || hiddenSum === 0) return trend;
  return trend.map((ponto) =>
    ponto.ano === ano && ponto.mes === mes
      ? { ...ponto, total: String(Number(ponto.total) - hiddenSum) }
      : ponto
  );
}

function sumTrends(lists: PontoTendencia[][]): PontoTendencia[] | undefined {
  if (lists.length === 0) return undefined;
  const [first] = lists;
  return first.map((ponto, i) => ({
    ano: ponto.ano,
    mes: ponto.mes,
    total: String(lists.reduce((sum, list) => sum + Number(list[i]?.total ?? 0), 0)),
  }));
}

interface GrupoTotal {
  group_id: number;
  group_nome: string;
  total: number;
  percentual: number;
  trend: PontoTendencia[] | undefined;
  subcategorias: CategoriaTotal[];
}

function GrupoAccordion({
  tipo,
  filter,
  periodoHistorico,
  regime,
  expandedGrupos,
  expandedSubcategorias,
  onToggleGrupo,
  onToggleSubcategoria,
  onSelecionarMes,
  hiddenCount,
  hiddenIds,
  hiddenSumBySubcategoria,
  onToggleHidden,
  onRestaurarTudo,
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  periodoHistorico: PeriodoHistorico;
  regime: Regime;
  expandedGrupos: number[];
  expandedSubcategorias: number[];
  onToggleGrupo: (id: number) => void;
  onToggleSubcategoria: (id: number) => void;
  onSelecionarMes: (ponto: { ano: number; mes: number }) => void;
  // "Ocultar gasto" (Sprint 27) — estado vive em DashboardsPage (não aqui)
  // porque os cards Receita/Despesa/Saldo do topo também precisam refletir
  // a simulação, não só este funil.
  hiddenCount: number;
  hiddenIds: Set<number>;
  hiddenSumBySubcategoria: Map<number, number>;
  onToggleHidden: (subcategoryId: number, transactionId: number, valor: number) => void;
  onRestaurarTudo: () => void;
}) {
  const query = useDashboardByCategoria(tipo, { ...filter, regime });
  const tendenciaQuery = useDashboardCategoriaTendencia(
    tipo,
    filter.ano,
    filter.mes,
    periodoHistorico,
    regime
  );
  const groupsQuery = useCategoryGroups();
  const subcategoriesQuery = useSubcategories();
  const orcamentoQuery = useDashboardPorOrcamento(tipo, { ...filter, regime });

  const orcamentoBySubcategoria = useMemo(() => {
    const map = new Map<number, OrcamentoStatus>();
    for (const item of orcamentoQuery.data ?? []) map.set(item.subcategory_id, item);
    return map;
  }, [orcamentoQuery.data]);

  const groupColorIndex = useMemo(
    () => buildColorIndexFromIds((groupsQuery.data ?? []).map((g) => g.id)),
    [groupsQuery.data]
  );
  const subcategoryTintIndex = useMemo(
    () => buildSubcategoryTintIndex(subcategoriesQuery.data ?? []),
    [subcategoriesQuery.data]
  );

  const trendBySubcategoria = useMemo(() => {
    const map = new Map<number, PontoTendencia[]>();
    for (const item of tendenciaQuery.data ?? []) map.set(item.subcategory_id, item.pontos);
    return map;
  }, [tendenciaQuery.data]);

  const grupos = useMemo<GrupoTotal[]>(() => {
    const items = query.data ?? [];
    const totalGeral = items.reduce((sum, item) => sum + Number(item.total), 0);
    const porGrupo = new Map<number, GrupoTotal>();
    for (const item of items) {
      const grupo = porGrupo.get(item.group_id) ?? {
        group_id: item.group_id,
        group_nome: item.group_nome,
        total: 0,
        percentual: 0,
        trend: undefined,
        subcategorias: [],
      };
      grupo.total += Number(item.total);
      grupo.subcategorias.push(item);
      porGrupo.set(item.group_id, grupo);
    }
    return [...porGrupo.values()]
      .map((grupo) => ({
        ...grupo,
        percentual: totalGeral > 0 ? (grupo.total / totalGeral) * 100 : 0,
        subcategorias: [...grupo.subcategorias].sort((a, b) => Number(b.total) - Number(a.total)),
        trend: sumTrends(
          grupo.subcategorias
            .map((s) => trendBySubcategoria.get(s.subcategory_id))
            .filter((pontos): pontos is PontoTendencia[] => pontos !== undefined)
        ),
      }))
      .sort((a, b) => b.total - a.total);
  }, [query.data, trendBySubcategoria]);

  // Grupos com o total/trend recalculados descontando os itens marcados
  // como "ocultar gasto" (ver hiddenSumBySubcategoria acima) — grupos (sem
  // ajuste) segue existindo à parte porque o gráfico comparativo de
  // categorias usa a série histórica original, não a simulação do mês
  // aberto (ver CategoriaComparativoChart).
  const gruposAjustados = useMemo<GrupoTotal[]>(() => {
    if (hiddenSumBySubcategoria.size === 0) return grupos;
    const ajustados = grupos.map((grupo) => {
      const subcategoriasAjustadas = grupo.subcategorias.map((sub) => {
        const hidden = hiddenSumBySubcategoria.get(sub.subcategory_id) ?? 0;
        if (hidden === 0) return sub;
        return { ...sub, total: String(Math.max(0, Number(sub.total) - hidden)) };
      });
      const totalAjustado = subcategoriasAjustadas.reduce((sum, s) => sum + Number(s.total), 0);
      const hiddenGrupo = grupo.subcategorias.reduce(
        (sum, s) => sum + (hiddenSumBySubcategoria.get(s.subcategory_id) ?? 0),
        0
      );
      return {
        ...grupo,
        total: totalAjustado,
        subcategorias: subcategoriasAjustadas,
        trend: applyHiddenToTrend(grupo.trend, filter.ano, filter.mes, hiddenGrupo),
      };
    });
    const totalGeralAjustado = ajustados.reduce((sum, g) => sum + g.total, 0);
    return ajustados
      .map((g) => ({
        ...g,
        percentual: totalGeralAjustado > 0 ? (g.total / totalGeralAjustado) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [grupos, hiddenSumBySubcategoria, filter.ano, filter.mes]);

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as categorias.</p>;
  if (grupos.length === 0) return <p className="dash-empty">Nenhuma transação neste período.</p>;

  const max = gruposAjustados[0]?.total ?? 1;

  return (
    <>
      <CategoriaComparativoChart
        grupos={grupos.map((grupo) => ({
          group_id: grupo.group_id,
          group_nome: grupo.group_nome,
          trend: grupo.trend,
          color: groupColorVar(grupo.group_id, groupColorIndex),
        }))}
      />
      {hiddenCount > 0 && (
        <p className="dash-hidden-summary">
          Simulando sem {hiddenCount} {hiddenCount === 1 ? "transação" : "transações"}.
          <button type="button" onClick={onRestaurarTudo}>
            Restaurar
          </button>
        </p>
      )}
      <ul className="dash-list dash-accordion">
        {gruposAjustados.map((grupo) => (
          <li key={grupo.group_id}>
            <div className="dash-accordion-item">
              <Row
                nome={grupo.group_nome}
                total={String(grupo.total)}
                percentual={grupo.percentual.toFixed(2)}
                max={max}
                color={groupColorVar(grupo.group_id, groupColorIndex)}
                expanded={expandedGrupos.includes(grupo.group_id)}
                onClick={() => onToggleGrupo(grupo.group_id)}
                trend={grupo.trend}
                onSelecionarMes={onSelecionarMes}
              />
              {expandedGrupos.includes(grupo.group_id) && (
                <div className="dash-accordion-panel">
                  <SubcategoriaAccordion
                    tipo={tipo}
                    groupId={grupo.group_id}
                    groupTotal={grupo.total}
                    subcategorias={grupo.subcategorias}
                    groupColorIndex={groupColorIndex}
                    subcategoryTintIndex={subcategoryTintIndex}
                    trendBySubcategoria={trendBySubcategoria}
                    filter={filter}
                    expandedSubcategorias={expandedSubcategorias}
                    onToggleSubcategoria={onToggleSubcategoria}
                    onSelecionarMes={onSelecionarMes}
                    hiddenSumBySubcategoria={hiddenSumBySubcategoria}
                    hiddenIds={hiddenIds}
                    onToggleHidden={onToggleHidden}
                    orcamentoBySubcategoria={orcamentoBySubcategoria}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function SubcategoriaAccordion({
  tipo,
  groupId,
  groupTotal,
  subcategorias,
  groupColorIndex,
  subcategoryTintIndex,
  trendBySubcategoria,
  filter,
  expandedSubcategorias,
  onToggleSubcategoria,
  onSelecionarMes,
  hiddenSumBySubcategoria,
  hiddenIds,
  onToggleHidden,
  orcamentoBySubcategoria,
}: {
  tipo: TransacaoTipo;
  groupId: number;
  groupTotal: number;
  subcategorias: CategoriaTotal[];
  groupColorIndex: Map<number, number>;
  subcategoryTintIndex: Map<number, number>;
  trendBySubcategoria: Map<number, PontoTendencia[]>;
  filter: PeriodoFiltro;
  expandedSubcategorias: number[];
  onToggleSubcategoria: (id: number) => void;
  onSelecionarMes: (ponto: { ano: number; mes: number }) => void;
  // "Ocultar gasto" (Sprint 27) — subcategorias já chega com item.total
  // ajustado (ver gruposAjustados em GrupoAccordion); só o trend (mapa
  // bruto compartilhado entre grupos) precisa de ajuste aqui.
  hiddenSumBySubcategoria: Map<number, number>;
  hiddenIds: Set<number>;
  onToggleHidden: (subcategoryId: number, transactionId: number, valor: number) => void;
  // Barra orçado-vs-realizado (PRD-030) — só presente nos dois funis de
  // Despesa/Receita (Row aceita a prop opcionalmente, sem componente
  // paralelo); ausente em qualquer outro consumidor de SubcategoriaAccordion.
  orcamentoBySubcategoria?: Map<number, OrcamentoStatus>;
}) {
  const max = Number(subcategorias[0]?.total ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {subcategorias.map((item) => {
        const percentual =
          groupTotal > 0 ? ((Number(item.total) / groupTotal) * 100).toFixed(2) : "0.00";
        const trend = applyHiddenToTrend(
          trendBySubcategoria.get(item.subcategory_id),
          filter.ano,
          filter.mes,
          hiddenSumBySubcategoria.get(item.subcategory_id) ?? 0
        );
        const orcamentoStatus = orcamentoBySubcategoria?.get(item.subcategory_id);
        const orcamento: OrcamentoRowInfo | undefined = orcamentoStatus
          ? {
              orcado: orcamentoStatus.orcado,
              realizado: orcamentoStatus.realizado,
              tipo,
              alerta:
                tipo === "debito"
                  ? Number(orcamentoStatus.realizado) > Number(orcamentoStatus.orcado)
                  : Number(orcamentoStatus.realizado) < Number(orcamentoStatus.orcado),
            }
          : undefined;
        return (
          <li key={item.subcategory_id}>
            <div className="dash-accordion-item">
              <Row
                nome={item.subcategory_nome}
                total={item.total}
                percentual={percentual}
                max={max}
                color={subcategoryColorVar(
                  item.subcategory_id,
                  groupId,
                  groupColorIndex,
                  subcategoryTintIndex
                )}
                expanded={expandedSubcategorias.includes(item.subcategory_id)}
                onClick={() => onToggleSubcategoria(item.subcategory_id)}
                trend={trend}
                onSelecionarMes={onSelecionarMes}
                orcamento={orcamento}
              />
              {expandedSubcategorias.includes(item.subcategory_id) && (
                <div className="dash-accordion-panel">
                  <TransactionsTable
                    filter={filter}
                    categoriaId={item.subcategory_id}
                    tipo={tipo}
                    totalParaPercentual={item.total}
                    emptyMessage="Nenhuma transação nesta categoria."
                    hiddenIds={hiddenIds}
                    onToggleHidden={(transactionId, valor) =>
                      onToggleHidden(item.subcategory_id, transactionId, valor)
                    }
                  />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PassivosAccordion({
  filter,
  regime,
  expandedRows,
  onToggleRow,
}: {
  filter: PeriodoFiltro;
  regime: Regime;
  expandedRows: number[];
  onToggleRow: (id: number) => void;
}) {
  const query = useLiabilityGastos({ ...filter, regime });
  const color = "var(--despesa)";

  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.total) - Number(a.total)),
    [query.data]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os passivos.</p>;
  if (sorted.length === 0)
    return <p className="dash-empty">Nenhuma transação vinculada a um passivo neste período.</p>;

  const max = Number(sorted[0]?.total ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {sorted.map((item) => (
        <li key={item.liability_id}>
          <div className="dash-accordion-item">
            <Row
              nome={item.liability_nome}
              total={item.total}
              max={max}
              color={color}
              expanded={expandedRows.includes(item.liability_id)}
              onClick={() => onToggleRow(item.liability_id)}
            />
            {expandedRows.includes(item.liability_id) && (
              <div className="dash-accordion-panel">
                <TransactionsTable
                  filter={filter}
                  liabilityId={item.liability_id}
                  tipo="debito"
                  emptyMessage="Nenhuma transação vinculada a este passivo neste período."
                />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Accordion Investimento → Holding (Sprint 24) — cada linha de investimento
// expande buscando suas holdings sob demanda (usePluggyInvestments só
// monta/busca quando a linha é expandida, sem query antecipada). Reaproveitado
// tanto no card Ativos quanto dentro do accordion do card Patrimônio.
function InvestimentosValorAtualList() {
  const query = useInvestimentos();
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.valor_atual) - Number(a.valor_atual)),
    [query.data]
  );
  // Cor por investimento (não mais var(--accent) fixo) — mesmo padrão de
  // buildColorIndexFromIds/groupColorVar já usado por AssetsValorAtualList.
  const colorIndex = useMemo(
    () => buildColorIndexFromIds((query.data ?? []).map((investimento) => investimento.id)),
    [query.data]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os investimentos.</p>;
  if (sorted.length === 0) return <p className="dash-empty">Nenhum investimento cadastrado.</p>;

  const max = Number(sorted[0]?.valor_atual ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {sorted.map((investimento) => (
        <li key={investimento.id}>
          <div className="dash-accordion-item">
            <Row
              nome={investimento.nome}
              total={investimento.valor_atual}
              max={max}
              color={groupColorVar(investimento.id, colorIndex)}
              expanded={expandedIds.includes(investimento.id)}
              onClick={() => setExpandedIds((prev) => toggleId(prev, investimento.id))}
            />
            {expandedIds.includes(investimento.id) && (
              <div className="dash-accordion-panel">
                <InvestimentoHoldingsList investimentoId={investimento.id} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function InvestimentoHoldingsList({ investimentoId }: { investimentoId: number }) {
  const query = usePluggyInvestments(investimentoId);
  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.valor_atual) - Number(a.valor_atual)),
    [query.data]
  );
  const totalGeral = useMemo(
    () => (query.data ?? []).reduce((sum, holding) => sum + Number(holding.valor_atual), 0),
    [query.data]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as holdings.</p>;
  if (sorted.length === 0)
    return <p className="dash-empty">Nenhuma holding vinculada a este investimento.</p>;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table holdings-table">
        <colgroup>
          <col className="col-nome" />
          <col className="col-valor" />
          <col className="col-percentual" />
        </colgroup>
        <thead>
          <tr>
            <th>Holding</th>
            <th>Saldo atual</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((holding: PluggyInvestment) => {
            const percentual =
              totalGeral > 0 ? (Number(holding.valor_atual) / totalGeral) * 100 : 0;
            return (
              <tr key={holding.id}>
                <td>{holding.nome}</td>
                <td>{formatCurrency(holding.valor_atual)}</td>
                <td className="pct-col">{formatPercent(percentual)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Accordion (Sprint 26) — troca a tabela plana pelo mesmo padrão
// dash-accordion/Row de InvestimentosValorAtualList (achado do CEO na
// validação pós-Sprint 25: "Valor atual por Ativo" era a única das 3 seções
// do card Ativos ainda em formato de tabela). Expande pra mostrar tipo e
// data de aquisição — os dois dados que a tabela antiga trazia em colunas
// próprias e que o Row colapsado (nome/barra/valor/%) não tem espaço pra
// exibir; sem query nova, mesmo useAssets() já carregado.
function AssetsValorAtualList() {
  const query = useAssets();
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const ativos = useMemo(
    () =>
      (query.data ?? [])
        .filter((asset) => asset.status === "ativo")
        .sort((a, b) => Number(b.valor_atual) - Number(a.valor_atual)),
    [query.data]
  );
  const totalGeral = useMemo(
    () => ativos.reduce((sum, asset) => sum + Number(asset.valor_atual), 0),
    [ativos]
  );
  const colorIndex = useMemo(
    () => buildColorIndexFromIds(ativos.map((asset) => asset.id)),
    [ativos]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os ativos.</p>;
  if (ativos.length === 0) return <p className="dash-empty">Nenhum ativo cadastrado.</p>;

  const max = Number(ativos[0]?.valor_atual ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {ativos.map((asset) => {
        const percentual =
          totalGeral > 0 ? ((Number(asset.valor_atual) / totalGeral) * 100).toFixed(2) : "0.00";
        return (
          <li key={asset.id}>
            <div className="dash-accordion-item">
              <Row
                nome={asset.nome}
                total={asset.valor_atual}
                percentual={percentual}
                max={max}
                color={groupColorVar(asset.id, colorIndex)}
                expanded={expandedIds.includes(asset.id)}
                onClick={() => setExpandedIds((prev) => toggleId(prev, asset.id))}
              />
              {expandedIds.includes(asset.id) && (
                <div className="dash-accordion-panel">
                  <p>
                    Tipo: {ASSET_TIPO_LABEL[asset.tipo] ?? asset.tipo} · Adquirido em{" "}
                    {asset.data_aquisicao}
                  </p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Sprint 25: troca a tabela plana pelo mesmo estilo barra+% de
// "Valor atual por Investimento" (dash-row), mas sem accordion — o CEO pediu
// só o estilo visual, sem conteúdo expansível e sem cor distinta por item
// (usa var(--despesa), mesma cor estática de PassivosAccordion).
function LiabilitiesValorAtualList() {
  const query = useLiabilities();
  const ativos = useMemo(
    () =>
      (query.data ?? [])
        .filter((liability) => liability.status === "ativo")
        .sort((a, b) => Number(b.saldo_devedor) - Number(a.saldo_devedor)),
    [query.data]
  );
  const totalGeral = useMemo(
    () => ativos.reduce((sum, liability) => sum + Number(liability.saldo_devedor), 0),
    [ativos]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os passivos.</p>;
  if (ativos.length === 0) return <p className="dash-empty">Nenhum passivo cadastrado.</p>;

  const max = Number(ativos[0]?.saldo_devedor ?? 1);
  const color = "var(--despesa)";

  return (
    <ul className="dash-list">
      {ativos.map((liability) => {
        const percentual =
          totalGeral > 0 ? (Number(liability.saldo_devedor) / totalGeral) * 100 : 0;
        const pct = max > 0 ? Math.max(4, (Number(liability.saldo_devedor) / max) * 100) : 0;
        return (
          <li key={liability.id} className="dash-row">
            <span className="nm">{liability.nome}</span>
            <span className="track">
              <span className="fillbar" style={{ width: `${pct}%`, background: color }} />
            </span>
            <span className="amt">{formatCurrency(liability.saldo_devedor)}</span>
            <span className="pct">{formatPercent(percentual)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Saldo por Conta Corrente (Sprint 28) — mesmo estilo bar+% de
// LiabilitiesValorAtualList (sem accordion, sem cor distinta por item),
// filtrado a `account_tipo === "corrente"` (PRD-028 critério 3: nem
// poupança nem cartão de crédito entram aqui). Reaproveitado tanto no card
// Ativos quanto dentro do accordion do card Patrimônio.
function SaldoContaCorrenteList() {
  const query = useSaldoPorConta();
  const contas = useMemo(
    () =>
      (query.data ?? [])
        .filter((conta) => conta.account_tipo === "corrente")
        .sort((a, b) => Number(b.saldo) - Number(a.saldo)),
    [query.data]
  );
  const totalGeral = useMemo(
    () => contas.reduce((sum, conta) => sum + Number(conta.saldo), 0),
    [contas]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar o saldo das contas.</p>;
  if (contas.length === 0) return <p className="dash-empty">Nenhuma conta corrente cadastrada.</p>;

  const max = Number(contas[0]?.saldo ?? 1);
  const color = "var(--accent)";

  return (
    <ul className="dash-list">
      {contas.map((conta) => {
        const percentual = totalGeral > 0 ? (Number(conta.saldo) / totalGeral) * 100 : 0;
        const pct = max > 0 ? Math.max(4, (Number(conta.saldo) / max) * 100) : 0;
        return (
          <li key={conta.account_id} className="dash-row">
            <span className="nm">{conta.account_nome}</span>
            <span className="track">
              <span className="fillbar" style={{ width: `${pct}%`, background: color }} />
            </span>
            <span className="amt">{formatCurrency(conta.saldo)}</span>
            <span className="pct">{formatPercent(percentual)}</span>
          </li>
        );
      })}
    </ul>
  );
}

type PatrimonioParte = "ativos" | "passivos" | "saldoAcumuladoMes";

// Accordion de 3 partes expansível in-place (Sprint 24, redesenhado na
// Sprint 28 para a fórmula Ativos − Passivos + Saldo Acumulado do Mês) —
// substitui a tabela com botões "Ver detalhe" que navegavam pra outra visão
// do funil. Cada parte reaproveita o mesmo componente já usado pelo card
// equivalente (Ativos expande em Gestão de Ativos/Investimentos/Saldo por
// Conta Corrente) ou o TrendChart já calculado no componente pai
// (saldoAcumuladoSparkline, evita buscar de novo). Os rótulos com sinal
// (+/−) compõem a própria memória de cálculo do Total.
function PatrimonioBreakdownPanel({
  regime,
  saldoAcumuladoSparkline,
  onSelecionarMes,
}: {
  regime: Regime;
  saldoAcumuladoSparkline: PontoTendencia[] | undefined;
  onSelecionarMes: (ponto: { ano: number; mes: number }) => void;
}) {
  const query = usePatrimonioBreakdown(regime);
  const [expandidas, setExpandidas] = useState<PatrimonioParte[]>([]);

  function toggle(parte: PatrimonioParte) {
    setExpandidas((prev) =>
      prev.includes(parte) ? prev.filter((p) => p !== parte) : [...prev, parte]
    );
  }

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError || !query.data) {
    return <p role="alert">Não foi possível carregar a composição do patrimônio.</p>;
  }

  const { ativos_totais, passivos, saldo_acumulado_mes, total } = query.data;

  // Só Passivos guarda uma magnitude sempre não-negativa que precisa do
  // sinal "−" explícito pra virar subtração na memória de cálculo — os
  // outros dois já vêm com o sinal certo do backend (ex.: saldo acumulado do
  // mês negativo já é exibido negativo por formatCurrency; prefixar "+ " na
  // frente de um valor já negativo duplicaria o sinal, "+ -R$ ...").
  const partes: {
    key: PatrimonioParte;
    label: string;
    valor: string;
    subtrai?: boolean;
    painel: ReactNode;
  }[] = [
    {
      key: "ativos",
      label: "Ativos",
      valor: ativos_totais,
      painel: (
        <>
          <h3>Gestão de Ativos</h3>
          <AssetsValorAtualList />
          <h3>Investimentos</h3>
          <InvestimentosValorAtualList />
          <h3>Saldo por Conta Corrente</h3>
          <SaldoContaCorrenteList />
        </>
      ),
    },
    {
      key: "passivos",
      label: "Passivos",
      valor: passivos,
      subtrai: true,
      painel: <LiabilitiesValorAtualList />,
    },
    {
      key: "saldoAcumuladoMes",
      label: "Saldo Acumulado do Mês",
      valor: saldo_acumulado_mes,
      painel:
        saldoAcumuladoSparkline && saldoAcumuladoSparkline.length > 0 ? (
          <TrendLineChart
            variant="card"
            pontos={saldoAcumuladoSparkline}
            color="var(--accent)"
            onSelecionarMes={onSelecionarMes}
          />
        ) : (
          <p className="dash-empty">Nenhuma conta com saldo inicial informado.</p>
        ),
    },
  ];

  return (
    <div className="patrimonio-breakdown">
      <ul className="dash-list dash-accordion">
        {partes.map((parte) => (
          <li key={parte.key}>
            <div className="dash-accordion-item">
              <button
                type="button"
                className={`dash-row${expandidas.includes(parte.key) ? " expanded" : ""}`}
                onClick={() => toggle(parte.key)}
                aria-expanded={expandidas.includes(parte.key)}
              >
                <span className="chev" aria-hidden="true">
                  ›
                </span>
                <span className="nm">{parte.label}</span>
                <span className="amt">
                  {parte.subtrai && "− "}
                  {formatCurrency(parte.valor)}
                </span>
              </button>
              {expandidas.includes(parte.key) && (
                <div className="dash-accordion-panel">{parte.painel}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="patrimonio-total">
        Total: <strong>{formatCurrency(total)}</strong>
      </p>
    </div>
  );
}

export interface OrcamentoRowInfo {
  orcado: string;
  realizado: string;
  // true = despesa estourou o orçado, ou receita não o atingiu — mesma
  // barra, sentido oposto de alerta por tipo (ver PRD-030). Decidido via
  // rodada Impeccable (Artifact): sem cor nova — sinaliza com contorno na
  // barra + símbolo ▲/▼, não com um 4º token semântico.
  alerta: boolean;
  tipo: TransacaoTipo;
}

export function Row({
  nome,
  total,
  percentual,
  max,
  color,
  onClick,
  expanded,
  trend,
  onSelecionarMes,
  orcamento,
}: {
  nome: string;
  total: string;
  percentual?: string;
  max: number;
  color: string;
  onClick: () => void;
  expanded: boolean;
  trend?: PontoTendencia[];
  onSelecionarMes?: (ponto: { ano: number; mes: number }) => void;
  orcamento?: OrcamentoRowInfo;
}) {
  const pct = max > 0 ? Math.max(4, (Number(total) / max) * 100) : 0;
  return (
    <button
      type="button"
      className={`dash-row${expanded ? " expanded" : ""}`}
      onClick={onClick}
      aria-expanded={expanded}
    >
      <span className="chev" aria-hidden="true">
        ›
      </span>
      {orcamento && (
        <span className={`orcamento-signal${orcamento.alerta ? " alerta" : ""}`} aria-hidden="true">
          {orcamento.alerta ? (orcamento.tipo === "debito" ? "▲" : "▼") : ""}
        </span>
      )}
      <span className="nm">{nome}</span>
      {trend && trend.length > 1 && (
        <TrendLineChart
          variant="row"
          pontos={trend}
          color={color}
          onSelecionarMes={onSelecionarMes}
        />
      )}
      <span className={`track${orcamento?.alerta ? " orcamento-alerta" : ""}`}>
        <span className="fillbar" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="amt">
        {formatCurrency(total)}
        {orcamento && (
          <span className="orcamento-sub">
            {orcamento.alerta
              ? orcamento.tipo === "debito"
                ? "estourou o orçado"
                : "abaixo do orçado"
              : `de ${formatCurrency(orcamento.orcado)} orçado`}
          </span>
        )}
      </span>
      {percentual !== undefined && <span className="pct">{formatPercent(percentual)}</span>}
    </button>
  );
}
