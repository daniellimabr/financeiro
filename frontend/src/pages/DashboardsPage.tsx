/**
 * DIRECTION CONTRACT — Sprint 5 / Impeccable new-work
 *
 * THESIS: personal finance dashboards default to "hero card + neutral SaaS
 * chrome" that summarizes and stops; this page instead makes despesa/receita
 * a bodily read (green/terracotta) instead of a labeled abstraction, and
 * treats every total as an honest entry point — nothing here is a dead end,
 * everything is one click from the transaction that produced it.
 * OWN-WORLD: warm-neutral surface (#f5f6f1 light / #18181b dark), one brand
 * accent (green, shared with the "receita" semantic), terracotta reserved
 * only for despesa — never used as chrome. System sans, tabular numerals,
 * 12px-radius cards, no icon+heading+text card scaffolding.
 * STORY: user already knows the month; sees four totals at a glance
 * (patrimônio marked "atual" so it never reads as period-scoped); clicks the
 * number they're curious about and lands one honest step closer to the line
 * item, with a visible trail back.
 * FIRST VIEWPORT: filtro ano/mês top-left, four summary tiles in a grid
 * immediately below, Despesa/Receita tiles visibly interactive, Patrimônio
 * tile carries an "atual" tag, no hero, no chart above the fold.
 * FORM: direction D (YNAB/Copilot-esque) from the Sprint 5 direction round —
 * confirmed by the user via published comparison artifacts, dark mode
 * adjusted to neutral charcoal per feedback (terracotta stays an accent,
 * never the background).
 * FINISH: unreviewed and undocumented is unfinished; this build ends with
 * the finish review, the verdict, and DESIGN.md.
 */
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import {
  SEM_CATEGORIA_ID,
  type CategoriaTotal,
  type MeioPagamentoTotal,
  type TransacaoTipo,
} from "../api/dashboards";
import { useDashboardByCategoria } from "../hooks/useDashboardByCategoria";
import { useDashboardByMeioPagamento } from "../hooks/useDashboardByMeioPagamento";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import { usePluggyTransactions } from "../hooks/usePluggyTransactions";

const MESES = [
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

const ACCOUNT_TIPO_LABEL: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  cartao_credito: "Cartão de crédito",
  investimento: "Investimento",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: string | undefined): string {
  if (value === undefined) return "—";
  return currencyFormatter.format(Number(value));
}

interface Categoria {
  id: number;
  nome: string;
}

interface DrillState {
  tipo: TransacaoTipo;
  categoria?: Categoria;
  meioPagamento?: string;
}

export function DashboardsPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [drill, setDrill] = useState<DrillState | null>(null);

  const filter = { ano, mes };
  const semanticColor = drill?.tipo === "credito" ? "var(--receita)" : "var(--despesa)";

  const summaryQuery = useDashboardSummary(filter);

  const categoriaQuery = useDashboardByCategoria(
    drill && !drill.categoria ? drill.tipo : undefined,
    filter
  );

  const meioPagamentoQuery = useDashboardByMeioPagamento(
    drill?.categoria && !drill.meioPagamento ? drill.tipo : undefined,
    { ...filter, categoriaId: drill?.categoria?.id }
  );

  const transacoesQuery = usePluggyTransactions(
    {
      ano,
      mes,
      subcategoryId: drill?.categoria?.id,
      accountTipo: drill?.meioPagamento,
      competencia: true,
    },
    { enabled: Boolean(drill?.meioPagamento) }
  );

  const view = !drill
    ? null
    : !drill.categoria
      ? "categoria"
      : !drill.meioPagamento
        ? "meio"
        : "transacoes";

  function abrirFunil(tipo: TransacaoTipo) {
    setDrill({ tipo });
  }

  function escolherCategoria(categoria: Categoria) {
    setDrill((prev) => (prev ? { ...prev, categoria } : prev));
  }

  function escolherMeioPagamento(meioPagamento: string) {
    setDrill((prev) => (prev ? { ...prev, meioPagamento } : prev));
  }

  function voltar() {
    setDrill((prev) => {
      if (!prev) return prev;
      if (prev.meioPagamento) return { tipo: prev.tipo, categoria: prev.categoria };
      if (prev.categoria) return { tipo: prev.tipo };
      return null;
    });
  }

  return (
    <section className="dash-page">
      <div className="dash-filter">
        <label>
          Mês
          <select
            aria-label="Mês"
            value={mes}
            onChange={(event) => setMes(Number(event.target.value))}
          >
            {MESES.map((nome, index) => (
              <option key={nome} value={index + 1}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ano
          <select
            aria-label="Ano"
            value={ano}
            onChange={(event) => setAno(Number(event.target.value))}
          >
            {[ano - 1, ano, ano + 1].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
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
          </button>
          <button
            type="button"
            className="dash-tile clickable"
            onClick={() => abrirFunil("debito")}
          >
            <span className="k">Despesa</span>
            <span className="v despesa">{formatCurrency(summaryQuery.data.despesa)}</span>
          </button>
          <div className="dash-tile">
            <span className="k">Saldo</span>
            <span className="v">{formatCurrency(summaryQuery.data.saldo)}</span>
          </div>
          <div className="dash-tile">
            <span className="k">Patrimônio</span>
            <span className="v">{formatCurrency(summaryQuery.data.patrimonio)}</span>
            <span className="tag">atual, fora do filtro de período</span>
          </div>
        </div>
      )}

      {drill && (
        <div className="dash-funnel">
          <Breadcrumb drill={drill} setDrill={setDrill} />

          {view === "categoria" && (
            <CategoriaView
              query={categoriaQuery}
              color={semanticColor}
              onSelect={escolherCategoria}
            />
          )}

          {view === "meio" && (
            <MeioPagamentoView
              query={meioPagamentoQuery}
              color={semanticColor}
              onSelect={escolherMeioPagamento}
            />
          )}

          {view === "transacoes" && <TransacoesView query={transacoesQuery} />}

          <button type="button" className="dash-back" onClick={voltar}>
            ← Voltar
          </button>
        </div>
      )}
    </section>
  );
}

function Breadcrumb({
  drill,
  setDrill,
}: {
  drill: DrillState;
  setDrill: (drill: DrillState | null) => void;
}) {
  const crumbs: { label: string; onClick: () => void }[] = [
    {
      label: drill.tipo === "credito" ? "Receita" : "Despesa",
      onClick: () => setDrill({ tipo: drill.tipo }),
    },
  ];
  if (drill.categoria) {
    crumbs.push({
      label: drill.categoria.nome,
      onClick: () => setDrill({ tipo: drill.tipo, categoria: drill.categoria }),
    });
  }
  if (drill.meioPagamento) {
    crumbs.push({
      label: ACCOUNT_TIPO_LABEL[drill.meioPagamento] ?? drill.meioPagamento,
      onClick: () => setDrill(drill),
    });
  }

  return (
    <nav className="dash-breadcrumb" aria-label="Navegação do detalhamento">
      {crumbs.map((crumb, index) => (
        <span key={crumb.label}>
          {index > 0 && <span className="sep">/</span>}
          {index === crumbs.length - 1 ? (
            <span className="current">{crumb.label}</span>
          ) : (
            <button type="button" onClick={crumb.onClick}>
              {crumb.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function CategoriaView({
  query,
  color,
  onSelect,
}: {
  query: ReturnType<typeof useDashboardByCategoria>;
  color: string;
  onSelect: (categoria: Categoria) => void;
}) {
  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => Number(b.total) - Number(a.total)),
    [query.data]
  );
  const chartData = useMemo(
    () => sorted.map((item) => ({ nome: item.subcategory_nome, total: Number(item.total) })),
    [sorted]
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as categorias.</p>;
  if (sorted.length === 0) return <p className="dash-empty">Nenhuma transação neste período.</p>;

  return (
    <>
      <DashChart data={chartData} color={color} />
      <ul className="dash-list">
        {sorted.map((item: CategoriaTotal) => (
          <li key={item.subcategory_id}>
            <Row
              nome={
                item.group_id === SEM_CATEGORIA_ID
                  ? item.subcategory_nome
                  : `${item.group_nome} · ${item.subcategory_nome}`
              }
              total={item.total}
              max={Number(chartData[0]?.total ?? 1)}
              color={color}
              onClick={() => onSelect({ id: item.subcategory_id, nome: item.subcategory_nome })}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function MeioPagamentoView({
  query,
  color,
  onSelect,
}: {
  query: ReturnType<typeof useDashboardByMeioPagamento>;
  color: string;
  onSelect: (meioPagamento: string) => void;
}) {
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
      <ul className="dash-list">
        {sorted.map((item: MeioPagamentoTotal) => (
          <li key={item.account_tipo}>
            <Row
              nome={ACCOUNT_TIPO_LABEL[item.account_tipo] ?? item.account_tipo}
              total={item.total}
              max={Number(chartData[0]?.total ?? 1)}
              color={color}
              onClick={() => onSelect(item.account_tipo)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function TransacoesView({ query }: { query: ReturnType<typeof usePluggyTransactions> }) {
  const data = query.data ?? [];

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as transações.</p>;
  if (data.length === 0)
    return <p className="dash-empty">Nenhuma transação neste meio de pagamento.</p>;

  return (
    <table className="dash-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {data.map((transaction) => (
          <tr key={transaction.id}>
            <td>{transaction.data}</td>
            <td>{transaction.descricao}</td>
            <td>{formatCurrency(transaction.valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({
  nome,
  total,
  max,
  color,
  onClick,
}: {
  nome: string;
  total: string;
  max: number;
  color: string;
  onClick: () => void;
}) {
  const pct = max > 0 ? Math.max(4, (Number(total) / max) * 100) : 0;
  return (
    <button type="button" className="dash-row" onClick={onClick}>
      <span className="nm">{nome}</span>
      <span className="track">
        <span className="fillbar" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="amt">{formatCurrency(total)}</span>
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
