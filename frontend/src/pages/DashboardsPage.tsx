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
  SEM_CATEGORIA_ID,
  type CategoriaTotal,
  type PeriodoHistorico,
  type PontoTendencia,
  type TransacaoTipo,
} from "../api/dashboards";
import type { PluggyTransaction } from "../api/pluggy";
import { AccountTipoIcon } from "../components/AccountTipoIcon";
import { CardSparkline } from "../components/CardSparkline";
import { PeriodFilter } from "../components/PeriodFilter";
import { useAssetGastos } from "../hooks/useAssetGastos";
import { useDashboardByCategoria } from "../hooks/useDashboardByCategoria";
import { useDashboardCategoriaTendencia } from "../hooks/useDashboardCategoriaTendencia";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { useDashboardTendencia } from "../hooks/useDashboardTendencia";
import { useLiabilityGastos } from "../hooks/useLiabilityGastos";
import { usePluggyTransactions } from "../hooks/usePluggyTransactions";
import { useSaldoPorConta } from "../hooks/useSaldoPorConta";
import { useTableSort } from "../hooks/useTableSort";
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

type DrillKind = "receita" | "despesa" | "ativos" | "passivos" | "saldo";

interface DrillState {
  kind: DrillKind;
  // ids das linhas expandidas na seção atualmente aberta (subcategory_id,
  // asset_id ou liability_id conforme kind) — só uma seção fica aberta por
  // vez, então um único array cobre os três casos.
  expandedRows: number[];
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
    setDrill((prev) => (prev?.kind === kind ? null : { kind, expandedRows: [] }));
  }

  function fecharFunil() {
    setDrill(null);
  }

  function toggleRow(id: number) {
    setDrill((prev) => {
      if (!prev) return prev;
      const expandida = prev.expandedRows.includes(id);
      return {
        ...prev,
        expandedRows: expandida
          ? prev.expandedRows.filter((rowId) => rowId !== id)
          : [...prev.expandedRows, id],
      };
    });
  }

  const drillTitle: Record<DrillKind, string> = {
    receita: "Receita",
    despesa: "Despesa",
    ativos: "Ativos",
    passivos: "Passivos",
    saldo: "Saldo",
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
              values={tendenciaQuery.data?.map((p) => Number(p.receita))}
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
              values={tendenciaQuery.data?.map((p) => Number(p.despesa))}
              color="var(--despesa)"
            />
          </button>
          <button type="button" className="dash-tile clickable" onClick={() => abrirFunil("saldo")}>
            <span className="k">Saldo</span>
            <span className="v">{formatCurrency(summaryQuery.data.saldo)}</span>
            <CardSparkline
              values={tendenciaQuery.data?.map((p) => Number(p.saldo))}
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
          <div className="dash-tile">
            <span className="k">Patrimônio</span>
            <span className="v">{formatCurrency(summaryQuery.data.patrimonio)}</span>
            <span className="tag">atual, fora do filtro de período — sem histórico ainda</span>
          </div>
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
            <CategoriaAccordion
              tipo={drill.kind === "receita" ? "credito" : "debito"}
              filter={filter}
              periodoHistorico={periodoHistorico}
              expandedRows={drill.expandedRows}
              onToggleRow={toggleRow}
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

function CategoriaAccordion({
  tipo,
  filter,
  periodoHistorico,
  expandedRows,
  onToggleRow,
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  periodoHistorico: PeriodoHistorico;
  expandedRows: number[];
  onToggleRow: (id: number) => void;
}) {
  const query = useDashboardByCategoria(tipo, filter);
  const tendenciaQuery = useDashboardCategoriaTendencia(
    tipo,
    filter.ano,
    filter.mes,
    periodoHistorico
  );
  const color = tipo === "credito" ? "var(--receita)" : "var(--despesa)";

  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.total) - Number(a.total)),
    [query.data]
  );
  const trendBySubcategoria = useMemo(() => {
    const map = new Map<number, PontoTendencia[]>();
    for (const item of tendenciaQuery.data ?? []) map.set(item.subcategory_id, item.pontos);
    return map;
  }, [tendenciaQuery.data]);

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as categorias.</p>;
  if (sorted.length === 0) return <p className="dash-empty">Nenhuma transação neste período.</p>;

  const max = Number(sorted[0]?.total ?? 1);

  return (
    <ul className="dash-list dash-accordion">
      {sorted.map((item: CategoriaTotal) => (
        <li key={item.subcategory_id}>
          <div className="dash-accordion-item">
            <Row
              nome={
                item.group_id === SEM_CATEGORIA_ID
                  ? item.subcategory_nome
                  : `${item.group_nome} · ${item.subcategory_nome}`
              }
              total={item.total}
              percentual={item.percentual}
              max={max}
              color={color}
              expanded={expandedRows.includes(item.subcategory_id)}
              onClick={() => onToggleRow(item.subcategory_id)}
              trend={trendBySubcategoria.get(item.subcategory_id)}
            />
            {expandedRows.includes(item.subcategory_id) && (
              <div className="dash-accordion-panel">
                <TransacoesPanel
                  filter={filter}
                  categoriaId={item.subcategory_id}
                  totalParaPercentual={item.total}
                  emptyMessage="Nenhuma transação nesta categoria."
                />
              </div>
            )}
          </div>
        </li>
      ))}
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
                <TransacoesPanel
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
                <TransacoesPanel
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
          <span className="amt">{formatCurrency(conta.saldo)}</span>
        </li>
      ))}
    </ul>
  );
}

type TransacaoSortKey = "data" | "descricao" | "valor";

function TransacoesPanel({
  filter,
  categoriaId,
  assetId,
  liabilityId,
  tipo,
  totalParaPercentual,
  emptyMessage,
}: {
  filter: PeriodoFiltro;
  categoriaId?: number;
  assetId?: number;
  liabilityId?: number;
  tipo?: TransacaoTipo;
  totalParaPercentual?: string;
  emptyMessage: string;
}) {
  const query = usePluggyTransactions({
    ano: filter.ano,
    mes: filter.mes,
    subcategoryId: categoriaId,
    assetId,
    liabilityId,
    tipo,
    competencia: true,
  });
  const data = query.data ?? [];
  const total = totalParaPercentual !== undefined ? Number(totalParaPercentual) : undefined;

  const { sorted, sortKey, direction, toggleSort } = useTableSort<
    PluggyTransaction,
    TransacaoSortKey
  >(data, (item, key) => (key === "valor" ? Number(item.valor) : item[key]), "data", "desc");

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as transações.</p>;
  if (data.length === 0) return <p className="dash-empty">{emptyMessage}</p>;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th aria-label="Meio de pagamento" />
            <SortableHeader
              label="Data"
              sortKeyName="data"
              currentKey={sortKey}
              direction={direction}
              onClick={() => toggleSort("data")}
            />
            <SortableHeader
              label="Descrição"
              sortKeyName="descricao"
              currentKey={sortKey}
              direction={direction}
              onClick={() => toggleSort("descricao")}
            />
            <SortableHeader
              label="Valor"
              sortKeyName="valor"
              currentKey={sortKey}
              direction={direction}
              onClick={() => toggleSort("valor")}
            />
            {total !== undefined && <th>%</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((transaction) => {
            const percentual =
              total !== undefined && total > 0
                ? (Math.abs(Number(transaction.valor)) / total) * 100
                : 0;
            return (
              <tr key={transaction.id}>
                <td>
                  <AccountTipoIcon tipo={transaction.account_tipo} />
                </td>
                <td>{transaction.data}</td>
                <td>{transaction.descricao}</td>
                <td>{formatCurrency(transaction.valor)}</td>
                {total !== undefined && <td className="pct-col">{formatPercent(percentual)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  sortKeyName,
  currentKey,
  direction,
  onClick,
}: {
  label: string;
  sortKeyName: TransacaoSortKey;
  currentKey: TransacaoSortKey;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  const active = currentKey === sortKeyName;
  return (
    <th
      className="sortable"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={onClick}>
        {label}
        {active && (
          <span className="sort-arrow" aria-hidden="true">
            {direction === "asc" ? "▲" : "▼"}
          </span>
        )}
      </button>
    </th>
  );
}

function Row({
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
