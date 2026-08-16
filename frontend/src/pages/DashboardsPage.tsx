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

import {
  type CategoriaTotal,
  type PeriodoHistorico,
  type PontoTendencia,
  type TransacaoTipo,
} from "../api/dashboards";
import { AccountTipoIcon } from "../components/AccountTipoIcon";
import { CardSparkline } from "../components/CardSparkline";
import { PeriodFilter } from "../components/PeriodFilter";
import { TransactionsTable } from "../components/TransactionsTable";
import { useAssetGastos } from "../hooks/useAssetGastos";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useDashboardByCategoria } from "../hooks/useDashboardByCategoria";
import { useDashboardCategoriaTendencia } from "../hooks/useDashboardCategoriaTendencia";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { useDashboardTendencia } from "../hooks/useDashboardTendencia";
import { useLiabilityGastos } from "../hooks/useLiabilityGastos";
import { usePatrimonioBreakdown } from "../hooks/usePatrimonioBreakdown";
import { useSaldoPorConta } from "../hooks/useSaldoPorConta";
import { useSubcategories } from "../hooks/useSubcategories";
import {
  buildGroupColorIndex,
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

function formatPercent(value: string | number): string {
  return `${Number(value).toFixed(1)}%`;
}

interface PeriodoFiltro {
  ano: number;
  mes: number;
}

type DrillKind = "receita" | "despesa" | "ativos" | "passivos" | "saldo" | "patrimonio";

function toggleId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((existing) => existing !== id) : [...list, id];
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
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [ativosTipo, setAtivosTipo] = useState<TransacaoTipo>("debito");

  const filter: PeriodoFiltro = { ano, mes };

  const summaryQuery = useDashboardSummary(filter);
  const tendenciaQuery = useDashboardTendencia(ano, mes, periodoHistorico);

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
  };

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
      </div>

      {summaryQuery.isLoading && <p>Carregando...</p>}
      {summaryQuery.isError && <p role="alert">Não foi possível carregar o resumo.</p>}

      {summaryQuery.data && (
        <div className="dash-summary">
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
          <button type="button" className="dash-tile clickable" onClick={() => abrirFunil("saldo")}>
            <span className="k">Saldo</span>
            <span className="v">{formatCurrency(summaryQuery.data.saldo)}</span>
            <CardSparkline
              pontos={tendenciaQuery.data?.map((p) => ({ ano: p.ano, mes: p.mes, total: p.saldo }))}
              color="var(--accent)"
            />
          </button>
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
            <span className="tag">atual, fora do filtro de período — sem histórico ainda</span>
          </button>
        </div>
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
                expandedRows={drill.expandedRows}
                onToggleRow={toggleRow}
              />
            </>
          )}

          {drill.kind === "passivos" && (
            <PassivosAccordion
              filter={filter}
              expandedRows={drill.expandedRows}
              onToggleRow={toggleRow}
            />
          )}

          {drill.kind === "saldo" && <SaldoPorContaList />}

          {drill.kind === "patrimonio" && (
            <PatrimonioBreakdownPanel onNavigate={(kind) => abrirFunil(kind)} />
          )}
        </div>
      )}
    </section>
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
  expandedGrupos,
  expandedSubcategorias,
  onToggleGrupo,
  onToggleSubcategoria,
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  periodoHistorico: PeriodoHistorico;
  expandedGrupos: number[];
  expandedSubcategorias: number[];
  onToggleGrupo: (id: number) => void;
  onToggleSubcategoria: (id: number) => void;
}) {
  const query = useDashboardByCategoria(tipo, filter);
  const tendenciaQuery = useDashboardCategoriaTendencia(
    tipo,
    filter.ano,
    filter.mes,
    periodoHistorico
  );
  const groupsQuery = useCategoryGroups();
  const subcategoriesQuery = useSubcategories();

  const groupColorIndex = useMemo(
    () => buildGroupColorIndex(groupsQuery.data ?? []),
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
  expandedRows,
  onToggleRow,
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  expandedRows: number[];
  onToggleRow: (id: number) => void;
}) {
  const query = useAssetGastos(tipo, filter);
  const color = tipo === "credito" ? "var(--receita)" : "var(--despesa)";

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
              color={color}
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
  expandedRows,
  onToggleRow,
}: {
  filter: PeriodoFiltro;
  expandedRows: number[];
  onToggleRow: (id: number) => void;
}) {
  const query = useLiabilityGastos(filter);
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

function PatrimonioBreakdownPanel({
  onNavigate,
}: {
  onNavigate: (kind: "ativos" | "passivos" | "saldo") => void;
}) {
  const query = usePatrimonioBreakdown();

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError || !query.data) {
    return <p role="alert">Não foi possível carregar a composição do patrimônio.</p>;
  }

  const { ativos, passivos, saldo_contas, saldo_cartoes, total } = query.data;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Componente</th>
            <th>Valor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ativos</td>
            <td>{formatCurrency(ativos)}</td>
            <td>
              <button type="button" onClick={() => onNavigate("ativos")}>
                Ver detalhe
              </button>
            </td>
          </tr>
          <tr>
            <td>Passivos</td>
            <td>-{formatCurrency(passivos)}</td>
            <td>
              <button type="button" onClick={() => onNavigate("passivos")}>
                Ver detalhe
              </button>
            </td>
          </tr>
          <tr>
            <td>Saldo em conta</td>
            <td>{formatCurrency(saldo_contas)}</td>
            <td>
              <button type="button" onClick={() => onNavigate("saldo")}>
                Ver detalhe
              </button>
            </td>
          </tr>
          <tr>
            <td>Saldo de cartão de crédito</td>
            <td>-{formatCurrency(saldo_cartoes)}</td>
            <td>
              <button type="button" onClick={() => onNavigate("saldo")}>
                Ver detalhe
              </button>
            </td>
          </tr>
          <tr>
            <td>
              <strong>Total</strong>
            </td>
            <td>
              <strong>{formatCurrency(total)}</strong>
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
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
