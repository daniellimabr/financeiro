/**
 * DIRECTION CONTRACT — Sprint 5 / Impeccable new-work (extended Sprint 6)
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
 * STORY: user already knows the month; sees four totals at a glance, each
 * with a sparkline of recent history (patrimônio marked "atual" so it never
 * reads as period-scoped, and explicitly flagged as having no history yet);
 * clicks the number they're curious about and expands an accordion funnel —
 * categoria, meio de pagamento and linha de extrato nest without ever hiding
 * a level the user already opened.
 * FIRST VIEWPORT: filtro ano/mês + seletor de histórico top-left, four
 * summary tiles in a grid immediately below, Despesa/Receita tiles visibly
 * interactive, Patrimônio tile carries an "atual" tag, no hero, no chart
 * above the fold.
 * FORM: direction D (YNAB/Copilot-esque) from the Sprint 5 direction round —
 * confirmed by the user via published comparison artifacts, dark mode
 * adjusted to neutral charcoal per feedback (terracotta stays an accent,
 * never the background).
 * FINISH: unreviewed and undocumented is unfinished; this build ends with
 * the finish review, the verdict, and DESIGN.md.
 */
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import {
  SEM_CATEGORIA_ID,
  type CategoriaTotal,
  type MeioPagamentoTotal,
  type PeriodoHistorico,
  type PontoTendencia,
  type TransacaoTipo,
} from "../api/dashboards";
import { PeriodFilter } from "../components/PeriodFilter";
import { useDashboardByCategoria } from "../hooks/useDashboardByCategoria";
import { useDashboardByMeioPagamento } from "../hooks/useDashboardByMeioPagamento";
import { useDashboardCategoriaTendencia } from "../hooks/useDashboardCategoriaTendencia";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { useDashboardTendencia } from "../hooks/useDashboardTendencia";
import { usePluggyTransactions } from "../hooks/usePluggyTransactions";
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

interface DrillState {
  tipo: TransacaoTipo;
  // subcategory_id das categorias expandidas — sanfona: múltiplas ao mesmo tempo.
  expandedCategorias: number[];
  // subcategory_id -> lista de account_tipo expandidos dentro daquela categoria.
  expandedMeios: Record<number, string[]>;
}

export function DashboardsPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [periodoHistorico, setPeriodoHistorico] = useState<PeriodoHistorico>(6);
  const [drill, setDrill] = useState<DrillState | null>(null);

  const filter: PeriodoFiltro = { ano, mes };

  const summaryQuery = useDashboardSummary(filter);
  const tendenciaQuery = useDashboardTendencia(ano, mes, periodoHistorico);

  function abrirFunil(tipo: TransacaoTipo) {
    setDrill((prev) =>
      prev?.tipo === tipo ? null : { tipo, expandedCategorias: [], expandedMeios: {} }
    );
  }

  function fecharFunil() {
    setDrill(null);
  }

  function toggleCategoria(subcategoryId: number) {
    setDrill((prev) => {
      if (!prev) return prev;
      const expandida = prev.expandedCategorias.includes(subcategoryId);
      return {
        ...prev,
        expandedCategorias: expandida
          ? prev.expandedCategorias.filter((id) => id !== subcategoryId)
          : [...prev.expandedCategorias, subcategoryId],
        expandedMeios: expandida
          ? Object.fromEntries(
              Object.entries(prev.expandedMeios).filter(([id]) => Number(id) !== subcategoryId)
            )
          : prev.expandedMeios,
      };
    });
  }

  function toggleMeio(subcategoryId: number, accountTipo: string) {
    setDrill((prev) => {
      if (!prev) return prev;
      const atual = prev.expandedMeios[subcategoryId] ?? [];
      const expandido = atual.includes(accountTipo);
      return {
        ...prev,
        expandedMeios: {
          ...prev.expandedMeios,
          [subcategoryId]: expandido
            ? atual.filter((tipo) => tipo !== accountTipo)
            : [...atual, accountTipo],
        },
      };
    });
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
      </div>

      {summaryQuery.isLoading && <p>Carregando...</p>}
      {summaryQuery.isError && <p role="alert">Não foi possível carregar o resumo.</p>}

      {summaryQuery.data && (
        <div className="dash-summary">
          <button
            type="button"
            className="dash-tile clickable"
            onClick={() => abrirFunil("credito")}
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
            onClick={() => abrirFunil("debito")}
          >
            <span className="k">Despesa</span>
            <span className="v despesa">{formatCurrency(summaryQuery.data.despesa)}</span>
            <CardSparkline
              values={tendenciaQuery.data?.map((p) => Number(p.despesa))}
              color="var(--despesa)"
            />
          </button>
          <div className="dash-tile">
            <span className="k">Saldo</span>
            <span className="v">{formatCurrency(summaryQuery.data.saldo)}</span>
            <CardSparkline
              values={tendenciaQuery.data?.map((p) => Number(p.saldo))}
              color="var(--accent)"
            />
          </div>
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
            <h2>{drill.tipo === "credito" ? "Receita" : "Despesa"}</h2>
            <button type="button" className="dash-back" onClick={fecharFunil}>
              Fechar
            </button>
          </div>

          <CategoriaAccordion
            tipo={drill.tipo}
            filter={filter}
            periodoHistorico={periodoHistorico}
            expandedCategorias={drill.expandedCategorias}
            expandedMeios={drill.expandedMeios}
            onToggleCategoria={toggleCategoria}
            onToggleMeio={toggleMeio}
          />
        </div>
      )}
    </section>
  );
}

function CardSparkline({ values, color }: { values: number[] | undefined; color: string }) {
  if (!values || values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <span className="spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height={28}>
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </span>
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
  expandedCategorias,
  expandedMeios,
  onToggleCategoria,
  onToggleMeio,
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  periodoHistorico: PeriodoHistorico;
  expandedCategorias: number[];
  expandedMeios: Record<number, string[]>;
  onToggleCategoria: (subcategoryId: number) => void;
  onToggleMeio: (subcategoryId: number, accountTipo: string) => void;
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
  const chartData = useMemo(
    () => sorted.map((item) => ({ nome: item.subcategory_nome, total: Number(item.total) })),
    [sorted]
  );
  const trendBySubcategoria = useMemo(() => {
    const map = new Map<number, PontoTendencia[]>();
    for (const item of tendenciaQuery.data ?? []) map.set(item.subcategory_id, item.pontos);
    return map;
  }, [tendenciaQuery.data]);

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as categorias.</p>;
  if (sorted.length === 0) return <p className="dash-empty">Nenhuma transação neste período.</p>;

  return (
    <>
      <DashChart data={chartData} color={color} />
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
                max={Number(chartData[0]?.total ?? 1)}
                color={color}
                expanded={expandedCategorias.includes(item.subcategory_id)}
                onClick={() => onToggleCategoria(item.subcategory_id)}
                trend={trendBySubcategoria.get(item.subcategory_id)}
              />
              {expandedCategorias.includes(item.subcategory_id) && (
                <div className="dash-accordion-panel">
                  <MeioPagamentoAccordion
                    tipo={tipo}
                    filter={filter}
                    categoriaId={item.subcategory_id}
                    expandedMeios={expandedMeios[item.subcategory_id] ?? []}
                    onToggleMeio={(accountTipo) => onToggleMeio(item.subcategory_id, accountTipo)}
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

function MeioPagamentoAccordion({
  tipo,
  filter,
  categoriaId,
  expandedMeios,
  onToggleMeio,
}: {
  tipo: TransacaoTipo;
  filter: PeriodoFiltro;
  categoriaId: number;
  expandedMeios: string[];
  onToggleMeio: (accountTipo: string) => void;
}) {
  const query = useDashboardByMeioPagamento(tipo, { ...filter, categoriaId });
  const color = tipo === "credito" ? "var(--receita)" : "var(--despesa)";

  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.total) - Number(a.total)),
    [query.data]
  );
  const chartData = useMemo(
    () =>
      sorted.map((item) => ({
        nome: ACCOUNT_TIPO_LABEL[item.account_tipo] ?? item.account_tipo,
        total: Number(item.total),
      })),
    [sorted]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar os meios de pagamento.</p>;
  if (sorted.length === 0) return <p className="dash-empty">Nenhuma transação nesta categoria.</p>;

  return (
    <>
      <DashChart data={chartData} color={color} />
      <ul className="dash-list dash-accordion">
        {sorted.map((item: MeioPagamentoTotal) => (
          <li key={item.account_tipo}>
            <div className="dash-accordion-item">
              <Row
                nome={ACCOUNT_TIPO_LABEL[item.account_tipo] ?? item.account_tipo}
                total={item.total}
                percentual={item.percentual}
                max={Number(chartData[0]?.total ?? 1)}
                color={color}
                expanded={expandedMeios.includes(item.account_tipo)}
                onClick={() => onToggleMeio(item.account_tipo)}
              />
              {expandedMeios.includes(item.account_tipo) && (
                <div className="dash-accordion-panel">
                  <TransacoesPanel
                    filter={filter}
                    categoriaId={categoriaId}
                    accountTipo={item.account_tipo}
                    meioPagamentoTotal={item.total}
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

function TransacoesPanel({
  filter,
  categoriaId,
  accountTipo,
  meioPagamentoTotal,
}: {
  filter: PeriodoFiltro;
  categoriaId: number;
  accountTipo: string;
  meioPagamentoTotal: string;
}) {
  const query = usePluggyTransactions({
    ano: filter.ano,
    mes: filter.mes,
    subcategoryId: categoriaId,
    accountTipo,
    competencia: true,
  });
  const data = query.data ?? [];
  const total = Number(meioPagamentoTotal);

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as transações.</p>;
  if (data.length === 0)
    return <p className="dash-empty">Nenhuma transação neste meio de pagamento.</p>;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {data.map((transaction) => {
            const percentual = total > 0 ? (Math.abs(Number(transaction.valor)) / total) * 100 : 0;
            return (
              <tr key={transaction.id}>
                <td>{transaction.data}</td>
                <td>{transaction.descricao}</td>
                <td>{formatCurrency(transaction.valor)}</td>
                <td className="pct-col">{formatPercent(percentual)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
  percentual: string;
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
      <span className="pct">{formatPercent(percentual)}</span>
    </button>
  );
}

function DashChart({ data, color }: { data: { nome: string; total: number }[]; color: string }) {
  return (
    <div className="dash-chart" aria-hidden="true">
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="nome"
            width={130}
            tick={{ fontSize: 12, fill: "var(--text)" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="total" radius={[0, 6, 6, 0]}>
            {data.map((entry) => (
              <Cell key={entry.nome} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
