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

import {
  type CategoriaTotal,
  type PeriodoHistorico,
  type PontoTendencia,
  type Regime,
  type TendenciaMes,
  type TransacaoTipo,
} from "../api/dashboards";
import type { PluggyInvestment } from "../api/pluggy";
import { AccountTipoIcon } from "../components/AccountTipoIcon";
import { CardSparkline } from "../components/CardSparkline";
import { PeriodFilter } from "../components/PeriodFilter";
import { RegimeToggle } from "../components/RegimeToggle";
import { TransactionsTable } from "../components/TransactionsTable";
import { TrendChart } from "../components/TrendChart";
import { useAssetGastos } from "../hooks/useAssetGastos";
import { useAssets } from "../hooks/useAssets";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useDashboardByCategoria } from "../hooks/useDashboardByCategoria";
import { useDashboardCategoriaTendencia } from "../hooks/useDashboardCategoriaTendencia";
import { useDashboardSaldoAcumulado } from "../hooks/useDashboardSaldoAcumulado";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { useDashboardTendencia } from "../hooks/useDashboardTendencia";
import { useEvolucaoSaldoPorConta } from "../hooks/useEvolucaoSaldoPorConta";
import { useInvestimentos } from "../hooks/useInvestimentos";
import { useLiabilities } from "../hooks/useLiabilities";
import { useLiabilityGastos } from "../hooks/useLiabilityGastos";
import { usePatrimonioBreakdown } from "../hooks/usePatrimonioBreakdown";
import { usePluggyInvestments } from "../hooks/usePluggyInvestments";
import { useSaldoPorConta } from "../hooks/useSaldoPorConta";
import { useSubcategories } from "../hooks/useSubcategories";
import {
  buildColorIndexFromIds,
  buildSubcategoryTintIndex,
  groupColorVar,
  subcategoryColorVar,
} from "../utils/categoryColors";
import { formatCurrency } from "../utils/format";

const ACCOUNT_TIPO_LABEL: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  cartao_credito: "Cartão de crédito",
  investimento: "Investimento",
};

const ASSET_TIPO_LABEL: Record<string, string> = {
  imovel: "Imóvel",
  veiculo: "Veículo",
  outro: "Outro",
};

const LIABILITY_TIPO_LABEL: Record<string, string> = {
  financiamento: "Financiamento",
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
  const [ativosTipo, setAtivosTipo] = useState<TransacaoTipo>("debito");

  const filter: PeriodoFiltro = { ano, mes };

  const summaryQuery = useDashboardSummary({ ...filter, regime });
  const tendenciaQuery = useDashboardTendencia(ano, mes, periodoHistorico, regime);
  const saldoAcumuladoQuery = useDashboardSaldoAcumulado(ano, mes, periodoHistorico, regime);

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
  }

  function fecharFunil() {
    setDrill(null);
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

  return (
    <section className="dash-page">
      <div className="dash-filter">
        <PeriodFilter
          ano={ano}
          mes={mes}
          onChange={(next) => {
            if (next.ano !== undefined) setAno(next.ano);
            if (next.mes !== undefined) setMes(next.mes);
          }}
        />
        <label>
          Histórico
          <select
            aria-label="Período histórico"
            value={periodoHistorico}
            onChange={(event) =>
              setPeriodoHistorico(Number(event.target.value) as PeriodoHistorico)
            }
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </label>
        <RegimeToggle value={regime} onChange={setRegime} />
      </div>

      {summaryQuery.isLoading && <p>Carregando...</p>}
      {summaryQuery.isError && <p role="alert">Não foi possível carregar o resumo.</p>}

      {summaryQuery.data && (
        <>
          <div className="dash-summary">
            <button
              type="button"
              className="dash-tile clickable"
              onClick={() => abrirFunil("ativos")}
            >
              <span className="k">Ativos</span>
              <span className="v">{formatCurrency(summaryQuery.data.ativos)}</span>
            </button>
            <button
              type="button"
              className="dash-tile clickable"
              onClick={() => abrirFunil("passivos")}
            >
              <span className="k">Passivos</span>
              <span className="v">{formatCurrency(summaryQuery.data.passivos)}</span>
            </button>
            <button
              type="button"
              className="dash-tile clickable"
              onClick={() => abrirFunil("patrimonio")}
            >
              <span className="k">Patrimônio</span>
              <span className="v">{formatCurrency(summaryQuery.data.patrimonio)}</span>
            </button>
          </div>

          <div className="dash-summary">
            <button type="button" className="dash-tile clickable" onClick={clicarSaldoAnterior}>
              <span className="k">
                <ArrowIcon direction="left" />
                Saldo Anterior
                {saldoAnterior &&
                  ` (${String(saldoAnterior.mes).padStart(2, "0")}/${saldoAnterior.ano})`}
              </span>
              <span className="v">{saldoAnterior ? formatCurrency(saldoAnterior.total) : "—"}</span>
            </button>
            <button
              type="button"
              className="dash-tile clickable"
              onClick={() => abrirFunil("receita")}
            >
              <span className="k">Receita</span>
              <span className="v receita">{formatCurrency(summaryQuery.data.receita)}</span>
              <CardSparkline
                pontos={tendenciaQuery.data?.map((p) => ({
                  ano: p.ano,
                  mes: p.mes,
                  total: p.receita,
                }))}
                color="var(--receita)"
              />
            </button>
            <button
              type="button"
              className="dash-tile clickable"
              onClick={() => abrirFunil("despesa")}
            >
              <span className="k">Despesa</span>
              <span className="v despesa">{formatCurrency(summaryQuery.data.despesa)}</span>
              <CardSparkline
                pontos={tendenciaQuery.data?.map((p) => ({
                  ano: p.ano,
                  mes: p.mes,
                  total: p.despesa,
                }))}
                color="var(--despesa)"
              />
            </button>
            <button
              type="button"
              className="dash-tile clickable"
              onClick={() => abrirFunil("saldo")}
            >
              <span className="k">Saldo</span>
              <span className="v">{formatCurrency(summaryQuery.data.saldo)}</span>
              <CardSparkline
                pontos={tendenciaQuery.data?.map((p) => ({
                  ano: p.ano,
                  mes: p.mes,
                  total: p.saldo,
                }))}
                color="var(--accent)"
              />
            </button>
            <div
              role="button"
              tabIndex={0}
              aria-label={`Saldo Acumulado ${
                saldoAcumuladoAtual ? formatCurrency(saldoAcumuladoAtual.total) : "—"
              }`}
              className="dash-tile clickable"
              onClick={() => abrirFunil("saldoAcumulado")}
              onKeyDown={teclaSaldoAcumulado}
            >
              <span className="k v-row">
                Saldo Acumulado
                <button
                  type="button"
                  className="dash-tile-arrow"
                  aria-label="Ver mês seguinte"
                  onClick={clicarSaldoAcumuladoSeguinte}
                >
                  <ArrowIcon direction="right" />
                </button>
              </span>
              <span className="v">
                {saldoAcumuladoAtual ? formatCurrency(saldoAcumuladoAtual.total) : "—"}
              </span>
              <CardSparkline pontos={saldoAcumuladoSparkline} color="var(--accent)" />
            </div>
          </div>
        </>
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
            />
          )}

          {drill.kind === "ativos" && (
            <>
              <div className="dash-toggle" role="group" aria-label="Tipo de transação">
                <button
                  type="button"
                  aria-pressed={ativosTipo === "debito"}
                  onClick={() => setAtivosTipo("debito")}
                >
                  Despesa
                </button>
                <button
                  type="button"
                  aria-pressed={ativosTipo === "credito"}
                  onClick={() => setAtivosTipo("credito")}
                >
                  Receita
                </button>
              </div>
              <AtivosAccordion
                tipo={ativosTipo}
                filter={filter}
                regime={regime}
                expandedRows={drill.expandedRows}
                onToggleRow={toggleRow}
              />
              <h3>Valor atual por Investimento</h3>
              <InvestimentosValorAtualList />
              <h3>Saldo por conta</h3>
              <SaldoPorContaList />
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
            />
          )}

          {drill.kind === "saldoAcumulado" && (
            <>
              <p className="dash-empty">
                Este valor soma o saldo inicial das contas com "Saldo inicial" configurado (ver
                Configurações) mais receitas/despesas por competência (ou caixa, no toggle acima) —
                não é o saldo bancário do dia. Salário recebido perto do fim do mês, por exemplo, só
                entra na competência do mês seguinte, mesmo já estando na conta; e uma compra no
                cartão de crédito entra na competência antes da fatura ser paga. Pra ver o saldo
                bancário atual por conta, use o card "Saldo".
              </p>
              {summaryQuery.data && (
                <SaldoAcumuladoMemoriaCalculo
                  ano={ano}
                  mes={mes}
                  periodoHistorico={periodoHistorico}
                  tendencia={tendenciaQuery.data}
                  acumulado={saldoAcumuladoSparkline}
                  receitaMes={summaryQuery.data.receita}
                  despesaMes={summaryQuery.data.despesa}
                />
              )}
              {saldoAcumuladoSparkline && saldoAcumuladoSparkline.length > 0 ? (
                <TrendChart pontos={saldoAcumuladoSparkline} color="var(--accent)" />
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

// Card "Saldo Acumulado": memória de cálculo (âncora + acumulação mês a mês
// até o mês filtrado) + resumo de receita/despesa do mês, acima do
// TrendChart já existente. Âncora vem de useEvolucaoSaldoPorConta (soma de
// saldo_inicial por conta) — endpoint já existente, sem mudança de backend.
function SaldoAcumuladoMemoriaCalculo({
  ano,
  mes,
  periodoHistorico,
  tendencia,
  acumulado,
  receitaMes,
  despesaMes,
}: {
  ano: number;
  mes: number;
  periodoHistorico: PeriodoHistorico;
  tendencia: TendenciaMes[] | undefined;
  acumulado: PontoTendencia[] | undefined;
  receitaMes: string;
  despesaMes: string;
}) {
  const evolucaoQuery = useEvolucaoSaldoPorConta(ano, mes, periodoHistorico);
  const ancora = useMemo(
    () => (evolucaoQuery.data ?? []).reduce((sum, conta) => sum + Number(conta.saldo_inicial), 0),
    [evolucaoQuery.data]
  );

  const linhas = useMemo(() => {
    if (!tendencia || !acumulado) return [];
    return acumulado.map((ponto, i) => ({
      ano: ponto.ano,
      mes: ponto.mes,
      receita: tendencia[i]?.receita ?? "0",
      despesa: tendencia[i]?.despesa ?? "0",
      total: ponto.total,
    }));
  }, [tendencia, acumulado]);

  if (evolucaoQuery.isLoading) return <p>Carregando memória de cálculo...</p>;
  if (evolucaoQuery.isError) {
    return <p role="alert">Não foi possível carregar a memória de cálculo.</p>;
  }

  return (
    <div className="dash-memoria-calculo">
      <p>
        Saldo inicial das contas (âncora): <strong>{formatCurrency(String(ancora))}</strong>
      </p>
      <p>
        <span style={{ color: "var(--receita)" }}>Receita do mês {formatCurrency(receitaMes)}</span>
        {" · "}
        <span style={{ color: "var(--despesa)" }}>Despesa do mês {formatCurrency(despesaMes)}</span>
      </p>
      {linhas.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table saldo-acumulado-memoria-table">
            <colgroup>
              <col className="col-mes" />
              <col className="col-valor" />
              <col className="col-valor" />
              <col className="col-valor" />
            </colgroup>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Receita</th>
                <th>Despesa</th>
                <th>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={`${linha.ano}-${linha.mes}`}>
                  <td>
                    {String(linha.mes).padStart(2, "0")}/{linha.ano}
                  </td>
                  <td>{formatCurrency(linha.receita)}</td>
                  <td>{formatCurrency(linha.despesa)}</td>
                  <td>{formatCurrency(linha.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowTrend({ pontos, color }: { pontos: PontoTendencia[]; color: string }) {
  const values = pontos.map((p) => Number(p.total));
  const max = Math.max(...values, 0.01);
  const width = 48;
  const height = 16;
  const points = values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * width : width / 2;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      className="trend"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
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
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  periodoHistorico: PeriodoHistorico;
  regime: Regime;
  expandedGrupos: number[];
  expandedSubcategorias: number[];
  onToggleGrupo: (id: number) => void;
  onToggleSubcategoria: (id: number) => void;
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

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as categorias.</p>;
  if (grupos.length === 0) return <p className="dash-empty">Nenhuma transação neste período.</p>;

  const max = grupos[0]?.total ?? 1;

  return (
    <ul className="dash-list dash-accordion">
      {grupos.map((grupo) => (
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
                />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
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
}) {
  const max = Number(subcategorias[0]?.total ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {subcategorias.map((item) => {
        const percentual =
          groupTotal > 0 ? ((Number(item.total) / groupTotal) * 100).toFixed(2) : "0.00";
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
                trend={trendBySubcategoria.get(item.subcategory_id)}
              />
              {expandedSubcategorias.includes(item.subcategory_id) && (
                <div className="dash-accordion-panel">
                  <TransactionsTable
                    filter={filter}
                    categoriaId={item.subcategory_id}
                    tipo={tipo}
                    totalParaPercentual={item.total}
                    emptyMessage="Nenhuma transação nesta categoria."
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

function AtivosAccordion({
  tipo,
  filter,
  regime,
  expandedRows,
  onToggleRow,
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  regime: Regime;
  expandedRows: number[];
  onToggleRow: (id: number) => void;
}) {
  const query = useAssetGastos(tipo, { ...filter, regime });
  // Cor por ativo (não mais fixa por tipo de transação) — índice construído
  // a partir de TODOS os ativos cadastrados (useAssets), não só os que
  // aparecem no período filtrado, pra manter a cor da mesma entidade
  // estável entre filtros (ver categoryColors.ts: "color follows the
  // entity, never its rank").
  const assetsQuery = useAssets();
  const colorIndex = useMemo(
    () => buildColorIndexFromIds((assetsQuery.data ?? []).map((asset) => asset.id)),
    [assetsQuery.data]
  );

  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.total) - Number(a.total)),
    [query.data]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os ativos.</p>;
  if (sorted.length === 0)
    return <p className="dash-empty">Nenhuma transação vinculada a um ativo neste período.</p>;

  const max = Number(sorted[0]?.total ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {sorted.map((item) => (
        <li key={item.asset_id}>
          <div className="dash-accordion-item">
            <Row
              nome={item.asset_nome}
              total={item.total}
              max={max}
              color={groupColorVar(item.asset_id, colorIndex)}
              expanded={expandedRows.includes(item.asset_id)}
              onClick={() => onToggleRow(item.asset_id)}
            />
            {expandedRows.includes(item.asset_id) && (
              <div className="dash-accordion-panel">
                <TransactionsTable
                  filter={filter}
                  assetId={item.asset_id}
                  tipo={tipo}
                  emptyMessage="Nenhuma transação vinculada a este ativo neste período."
                />
              </div>
            )}
          </div>
        </li>
      ))}
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

function SaldoPorContaList() {
  const query = useSaldoPorConta();
  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.saldo) - Number(a.saldo)),
    [query.data]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar o saldo por conta.</p>;
  if (sorted.length === 0) return <p className="dash-empty">Nenhuma conta cadastrada.</p>;

  return (
    <ul className="dash-list">
      {sorted.map((conta) => (
        <li key={conta.account_id} className="dash-row">
          <AccountTipoIcon tipo={conta.account_tipo} />
          <span className="nm">{conta.account_nome}</span>
          <span className="tag">
            {ACCOUNT_TIPO_LABEL[conta.account_tipo] ?? conta.account_tipo}
          </span>
          <span className="amt">
            {formatCurrency(conta.saldo)}
            {conta.limite_credito !== null && (
              <span className="amt-detail"> (limite {formatCurrency(conta.limite_credito)})</span>
            )}
          </span>
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
              color="var(--accent)"
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

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as holdings.</p>;
  if (sorted.length === 0)
    return <p className="dash-empty">Nenhuma holding vinculada a este investimento.</p>;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <colgroup>
          <col className="col-nome" />
          <col className="col-valor" />
        </colgroup>
        <thead>
          <tr>
            <th>Holding</th>
            <th>Saldo atual</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((holding: PluggyInvestment) => (
            <tr key={holding.id}>
              <td>{holding.nome}</td>
              <td>{formatCurrency(holding.valor_atual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetsValorAtualList() {
  const query = useAssets();
  const ativos = useMemo(
    () =>
      (query.data ?? [])
        .filter((asset) => asset.status === "ativo")
        .sort((a, b) => Number(b.valor_atual) - Number(a.valor_atual)),
    [query.data]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os ativos.</p>;
  if (ativos.length === 0) return <p className="dash-empty">Nenhum ativo cadastrado.</p>;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <colgroup>
          <col className="col-nome" />
          <col className="col-tipo" />
          <col className="col-valor" />
        </colgroup>
        <thead>
          <tr>
            <th>Ativo</th>
            <th>Tipo</th>
            <th>Valor atual</th>
          </tr>
        </thead>
        <tbody>
          {ativos.map((asset) => (
            <tr key={asset.id}>
              <td>{asset.nome}</td>
              <td>{ASSET_TIPO_LABEL[asset.tipo] ?? asset.tipo}</td>
              <td>{formatCurrency(asset.valor_atual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiabilitiesValorAtualList() {
  const query = useLiabilities();
  const ativos = useMemo(
    () =>
      (query.data ?? [])
        .filter((liability) => liability.status === "ativo")
        .sort((a, b) => Number(b.saldo_devedor) - Number(a.saldo_devedor)),
    [query.data]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os passivos.</p>;
  if (ativos.length === 0) return <p className="dash-empty">Nenhum passivo cadastrado.</p>;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <colgroup>
          <col className="col-nome" />
          <col className="col-tipo" />
          <col className="col-valor" />
        </colgroup>
        <thead>
          <tr>
            <th>Passivo</th>
            <th>Tipo</th>
            <th>Saldo devedor</th>
          </tr>
        </thead>
        <tbody>
          {ativos.map((liability) => (
            <tr key={liability.id}>
              <td>{liability.nome}</td>
              <td>{LIABILITY_TIPO_LABEL[liability.tipo] ?? liability.tipo}</td>
              <td>{formatCurrency(liability.saldo_devedor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PatrimonioParte = "ativos" | "passivos" | "saldoInvestimentos" | "saldoLiquido";

// Accordion de 4 partes expansível in-place (Sprint 24) — substitui a
// tabela com botões "Ver detalhe" que navegavam pra outra visão do funil.
// Cada parte reaproveita o mesmo componente já usado pelo card equivalente
// (Ativos/Passivos/Investimentos) ou o TrendChart já calculado no
// componente pai (saldoAcumuladoSparkline, evita buscar de novo). Os
// rótulos com sinal (+/−) compõem a própria memória de cálculo do Total.
function PatrimonioBreakdownPanel({
  regime,
  saldoAcumuladoSparkline,
}: {
  regime: Regime;
  saldoAcumuladoSparkline: PontoTendencia[] | undefined;
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

  const { ativos, passivos, saldo_liquido_acumulado, saldo_investimentos, total } = query.data;

  const partes: {
    key: PatrimonioParte;
    label: string;
    valor: string;
    sinal: "+" | "−";
    painel: ReactNode;
  }[] = [
    { key: "ativos", label: "Ativos", valor: ativos, sinal: "+", painel: <AssetsValorAtualList /> },
    {
      key: "passivos",
      label: "Passivos",
      valor: passivos,
      sinal: "−",
      painel: <LiabilitiesValorAtualList />,
    },
    {
      key: "saldoInvestimentos",
      label: "Saldo em investimentos",
      valor: saldo_investimentos,
      sinal: "+",
      painel: <InvestimentosValorAtualList />,
    },
    {
      key: "saldoLiquido",
      label: "Saldo líquido acumulado",
      valor: saldo_liquido_acumulado,
      sinal: "+",
      painel:
        saldoAcumuladoSparkline && saldoAcumuladoSparkline.length > 0 ? (
          <TrendChart pontos={saldoAcumuladoSparkline} color="var(--accent)" />
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
                  {parte.sinal === "−" ? "− " : "+ "}
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

export function Row({
  nome,
  total,
  percentual,
  max,
  color,
  onClick,
  expanded,
  trend,
}: {
  nome: string;
  total: string;
  percentual?: string;
  max: number;
  color: string;
  onClick: () => void;
  expanded: boolean;
  trend?: PontoTendencia[];
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
      <span className="nm">{nome}</span>
      {trend && trend.length > 1 && <RowTrend pontos={trend} color={color} />}
      <span className="track">
        <span className="fillbar" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="amt">{formatCurrency(total)}</span>
      {percentual !== undefined && <span className="pct">{formatPercent(percentual)}</span>}
    </button>
  );
}
