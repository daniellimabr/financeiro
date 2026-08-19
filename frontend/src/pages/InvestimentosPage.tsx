import { Fragment, useMemo, useState, type FormEvent } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Investimento, InvestimentoInput } from "../api/investimentos";
import type { PluggyInvestment } from "../api/pluggy";
import type {
  PeriodoFilter,
  PeriodoHistorico,
  PontoTendencia,
  TransacaoTipo,
} from "../api/dashboards";
import { PeriodFilter } from "../components/PeriodFilter";
import { TrendLineChart } from "../components/TrendLineChart";
import { useCreateInvestimento } from "../hooks/useCreateInvestimento";
import { useDeleteInvestimento } from "../hooks/useDeleteInvestimento";
import { useEvolucaoMensal } from "../hooks/useEvolucaoMensal";
import { useInvestimentoEvolucao } from "../hooks/useInvestimentoEvolucao";
import { useInvestimentoGastos } from "../hooks/useInvestimentoGastos";
import { useInvestimentoGastosTendencia } from "../hooks/useInvestimentoGastosTendencia";
import { useInvestimentos } from "../hooks/useInvestimentos";
import { useInvestimentoTransacoes } from "../hooks/useInvestimentoTransacoes";
import { usePluggyInvestments } from "../hooks/usePluggyInvestments";
import { usePluggyInvestmentTransactions } from "../hooks/usePluggyInvestmentTransactions";
import { useUpdateInvestimento } from "../hooks/useUpdateInvestimento";
import { formatCurrency } from "../utils/format";

type DrillView = "extrato" | "posicoes" | "serie";

const EMPTY_FORM: InvestimentoInput = { nome: "" };

const PERIODO_HISTORICO: PeriodoHistorico = 6;

export function InvestimentosPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const filter: PeriodoFilter = { ano, mes };

  // Clique num ponto de gráfico de linha filtra a tela por aquele mês/ano
  // (Sprint 26) — mesmo helper replicado em cada tela que usa TrendLineChart.
  function selecionarMes(ponto: { ano: number; mes: number }) {
    setAno(ponto.ano);
    setMes(ponto.mes);
  }

  const [drillTipo, setDrillTipo] = useState<TransacaoTipo>("debito");

  const investimentosQuery = useInvestimentos();
  const { data: investments } = usePluggyInvestments();
  const createInvestimento = useCreateInvestimento();
  const updateInvestimento = useUpdateInvestimento();
  const deleteInvestimento = useDeleteInvestimento();
  const tendenciaQuery = useInvestimentoGastosTendencia(drillTipo, ano, mes, PERIODO_HISTORICO);

  const [editingInvestimentoId, setEditingInvestimentoId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<InvestimentoInput>(EMPTY_FORM);

  const [selectedInvestimentoId, setSelectedInvestimentoId] = useState<number | null>(null);
  const [drillView, setDrillView] = useState<DrillView>("posicoes");

  const investimentos = investimentosQuery.data ?? [];
  const selectedInvestimento =
    investimentos.find((investimento) => investimento.id === selectedInvestimentoId) ?? null;

  const trendByInvestimento = useMemo(() => {
    const map = new Map<number, PontoTendencia[]>();
    for (const item of tendenciaQuery.data ?? []) map.set(item.investimento_id, item.pontos);
    return map;
  }, [tendenciaQuery.data]);

  const trendColor = drillTipo === "credito" ? "var(--receita)" : "var(--despesa)";

  function posicoesDe(investimentoId: number) {
    return (investments ?? []).filter(
      (investment) => investment.investimento_id === investimentoId
    );
  }

  function openCreateForm() {
    setEditingInvestimentoId(null);
    setFormState(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(investimento: Investimento) {
    setEditingInvestimentoId(investimento.id);
    setFormState({ nome: investimento.nome });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (editingInvestimentoId !== null) {
      updateInvestimento.mutate(
        { investimentoId: editingInvestimentoId, input: formState },
        { onSuccess: closeForm }
      );
    } else {
      createInvestimento.mutate(formState, { onSuccess: closeForm });
    }
  }

  function handleDelete(investimentoId: number, nome: string) {
    if (
      window.confirm(
        `Excluir "${nome}"? Carteiras e transações vinculadas não são excluídas, só desassociadas.`
      )
    ) {
      deleteInvestimento.mutate(investimentoId);
      if (selectedInvestimentoId === investimentoId) setSelectedInvestimentoId(null);
    }
  }

  function toggleDrilldown(investimentoId: number) {
    setSelectedInvestimentoId((prev) => (prev === investimentoId ? null : investimentoId));
    setDrillView("posicoes");
  }

  return (
    <section className="dash-page">
      <h2>Investimentos</h2>

      <div className="dash-filter">
        <PeriodFilter
          ano={ano}
          mes={mes}
          onChange={(next) => {
            if (next.ano !== undefined) setAno(next.ano);
            if (next.mes !== undefined) setMes(next.mes);
          }}
        />
        <div className="dash-toggle" role="group" aria-label="Tipo de transação">
          <button
            type="button"
            aria-pressed={drillTipo === "debito"}
            onClick={() => setDrillTipo("debito")}
          >
            Aporte
          </button>
          <button
            type="button"
            aria-pressed={drillTipo === "credito"}
            onClick={() => setDrillTipo("credito")}
          >
            Resgate
          </button>
        </div>
        <button type="button" onClick={openCreateForm}>
          Novo investimento
        </button>
      </div>

      {(createInvestimento.isError || updateInvestimento.isError) && (
        <p role="alert">Não foi possível salvar o investimento.</p>
      )}
      {deleteInvestimento.isError && <p role="alert">Não foi possível excluir o investimento.</p>}

      {formOpen && (
        <div
          role="dialog"
          aria-label={editingInvestimentoId !== null ? "Editar investimento" : "Novo investimento"}
        >
          <form className="dash-filter" onSubmit={submitForm}>
            <label>
              Nome
              <input
                aria-label="Nome"
                value={formState.nome}
                required
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, nome: event.target.value }))
                }
              />
            </label>
            <button
              type="submit"
              disabled={createInvestimento.isPending || updateInvestimento.isPending}
            >
              Salvar
            </button>
            <button type="button" onClick={closeForm}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {investimentosQuery.isLoading && <p>Carregando...</p>}
      {investimentosQuery.isError && (
        <p role="alert">Não foi possível carregar os investimentos.</p>
      )}
      {!investimentosQuery.isLoading && investimentos.length === 0 && (
        <p className="dash-empty">Nenhum investimento cadastrado.</p>
      )}

      <div className="dash-summary">
        {investimentos.map((investimento) => (
          <InvestimentoCard
            key={investimento.id}
            investimento={investimento}
            pontos={trendByInvestimento.get(investimento.id)}
            trendColor={trendColor}
            expanded={selectedInvestimentoId === investimento.id}
            onToggleDrilldown={() => toggleDrilldown(investimento.id)}
            onEdit={() => openEditForm(investimento)}
            onDelete={() => handleDelete(investimento.id, investimento.nome)}
            onSelecionarMes={selecionarMes}
          />
        ))}
      </div>

      {selectedInvestimento && (
        <div className="dash-funnel">
          <div className="dash-funnel-head">
            <h2>{selectedInvestimento.nome}</h2>
            <button
              type="button"
              className="dash-back"
              onClick={() => setSelectedInvestimentoId(null)}
            >
              Fechar
            </button>
          </div>
          <div className="dash-toggle" role="group" aria-label="Visão do investimento">
            <button
              type="button"
              aria-pressed={drillView === "extrato"}
              onClick={() => setDrillView("extrato")}
            >
              Extrato
            </button>
            <button
              type="button"
              aria-pressed={drillView === "posicoes"}
              onClick={() => setDrillView("posicoes")}
            >
              Posições
            </button>
            <button
              type="button"
              aria-pressed={drillView === "serie"}
              onClick={() => setDrillView("serie")}
            >
              Série histórica
            </button>
          </div>
          {drillView === "extrato" && (
            <InvestimentoDrilldown
              investimentoId={selectedInvestimento.id}
              tipo={drillTipo}
              filter={filter}
              pontos={trendByInvestimento.get(selectedInvestimento.id)}
              onSelecionarMes={selecionarMes}
            />
          )}
          {drillView === "posicoes" && (
            <InvestimentoPosicoes posicoes={posicoesDe(selectedInvestimento.id)} />
          )}
          {drillView === "serie" && (
            <InvestimentoSerieHistorica investimentoId={selectedInvestimento.id} />
          )}
        </div>
      )}
    </section>
  );
}

function InvestimentoCard({
  investimento,
  pontos,
  trendColor,
  expanded,
  onToggleDrilldown,
  onEdit,
  onDelete,
  onSelecionarMes,
}: {
  investimento: Investimento;
  pontos: PontoTendencia[] | undefined;
  trendColor: string;
  expanded: boolean;
  onToggleDrilldown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelecionarMes: (ponto: { ano: number; mes: number }) => void;
}) {
  const evolucaoQuery = useInvestimentoEvolucao(investimento.id);
  const evolucao = evolucaoQuery.data;

  return (
    <div className="dash-tile">
      <span className="v">{evolucao ? formatCurrency(evolucao.saldo_atual) : "—"}</span>
      <strong>{investimento.nome}</strong>
      {evolucao && (
        <span className="tag" title="Estimativa: saldo atual − saldo base − aportes + resgates">
          Rendimento estimado: {formatCurrency(evolucao.rendimento_estimado)}
        </span>
      )}
      <TrendLineChart
        variant="spark"
        pontos={pontos}
        color={trendColor}
        onSelecionarMes={onSelecionarMes}
      />
      <div className="dash-filter">
        <button type="button" aria-expanded={expanded} onClick={onToggleDrilldown}>
          {expanded ? "Fechar posições" : "Ver posições"}
        </button>
        <button className="btn-ghost" type="button" onClick={onEdit}>
          Editar
        </button>
        <button className="btn-ghost btn-quiet btn-danger" type="button" onClick={onDelete}>
          Excluir
        </button>
      </div>
    </div>
  );
}

function InvestimentoDrilldown({
  investimentoId,
  tipo,
  filter,
  pontos,
  onSelecionarMes,
}: {
  investimentoId: number;
  tipo: TransacaoTipo;
  filter: PeriodoFilter;
  pontos: PontoTendencia[] | undefined;
  onSelecionarMes: (ponto: { ano: number; mes: number }) => void;
}) {
  const gastosQuery = useInvestimentoGastos(tipo, filter);
  const transacoesQuery = useInvestimentoTransacoes(investimentoId, filter);

  const total =
    gastosQuery.data?.find((item) => item.investimento_id === investimentoId)?.total ?? "0";
  const color = tipo === "credito" ? "var(--receita)" : "var(--despesa)";
  const rotulo = tipo === "credito" ? "Resgate" : "Aporte";

  const transacoes = transacoesQuery.data ?? [];

  return (
    <>
      {pontos && pontos.length > 1 && (
        <TrendLineChart
          variant="card"
          pontos={pontos}
          color={color}
          onSelecionarMes={onSelecionarMes}
        />
      )}
      {!gastosQuery.isLoading && !gastosQuery.isError && (
        <p>
          {rotulo} no período: <strong style={{ color }}>{formatCurrency(total)}</strong>
        </p>
      )}
      {gastosQuery.isError && <p role="alert">Não foi possível carregar o total do período.</p>}
      {transacoesQuery.isLoading && <p>Carregando...</p>}
      {transacoesQuery.isError && (
        <p role="alert">Não foi possível carregar o extrato do investimento.</p>
      )}
      {!transacoesQuery.isLoading && !transacoesQuery.isError && transacoes.length === 0 && (
        <p className="dash-empty">Nenhuma transação vinculada neste período.</p>
      )}
      {transacoes.length > 0 && (
        <div className="dash-table-wrap">
          <table className="dash-table extrato-unificado-table">
            <colgroup>
              <col className="col-data" />
              <col className="col-tipo" />
              <col className="col-descricao" />
              <col className="col-valor" />
              <col className="col-origem" />
            </colgroup>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.map((transacao, index) => (
                <tr key={`${transacao.origem}-${transacao.data}-${index}`}>
                  <td>{transacao.data}</td>
                  <td>{transacao.tipo}</td>
                  <td>{transacao.descricao ?? transacao.holding_nome ?? "—"}</td>
                  <td>{formatCurrency(transacao.valor)}</td>
                  <td>
                    <span className="tag">
                      {transacao.origem === "holding" ? "Holding" : "Conta"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function InvestimentoPosicoes({ posicoes }: { posicoes: PluggyInvestment[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (posicoes.length === 0) {
    return <p className="dash-empty">Nenhuma posição vinculada a este investimento.</p>;
  }

  return (
    <div className="dash-table-wrap">
      <table className="dash-table posicoes-table">
        <colgroup>
          <col className="col-tipo" />
          <col className="col-nome" />
          <col className="col-quantidade" />
          <col className="col-valor" />
          <col className="col-acao" />
        </colgroup>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Nome/Código</th>
            <th>Quantidade</th>
            <th>Valor atual</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posicoes.map((posicao) => {
            const isExpanded = expandedId === posicao.id;
            return (
              <Fragment key={posicao.id}>
                <tr>
                  <td>
                    {posicao.tipo}
                    {posicao.subtipo ? ` / ${posicao.subtipo}` : ""}
                  </td>
                  <td>{posicao.codigo ?? posicao.nome}</td>
                  <td>{posicao.quantidade ?? "—"}</td>
                  <td>{formatCurrency(posicao.valor_atual)}</td>
                  <td>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : posicao.id)}
                    >
                      {isExpanded ? "Fechar histórico" : "Ver histórico"}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={5}>
                      <PosicaoHistorico investmentId={posicao.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InvestimentoSerieHistorica({ investimentoId }: { investimentoId: number }) {
  const { data: serie, isLoading, isError } = useEvolucaoMensal(investimentoId);

  if (isLoading) return <p>Carregando...</p>;
  if (isError) return <p role="alert">Não foi possível carregar a série histórica.</p>;
  if (!serie || serie.length === 0) {
    return (
      <p className="dash-empty">
        Nenhum snapshot mensal ainda — confirme o baseline de dez/2025 em "Gestão de contas" pra
        popular a série histórica.
      </p>
    );
  }

  const temReconstruido = serie.some((ponto) => ponto.confianca === "reconstruido");
  const chartData = serie.map((ponto) => ({ mes: ponto.ano_mes, saldo: Number(ponto.saldo) }));

  return (
    <>
      {temReconstruido && (
        <p className="dash-empty">
          Meses marcados "reconstruido" são reconstrução por fluxo de caixa (sem fonte de cotação
          histórica pra ações nem de índice CDI/IPCA histórico pra renda fixa indexada) —
          valorização/rendimento reais só a partir do primeiro snapshot do job mensal.
        </p>
      )}
      <div className="dash-chart">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: "var(--text)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              formatter={(value) => formatCurrency(value as number)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--text-h)" }}
            />
            <Line
              type="monotone"
              dataKey="saldo"
              stroke="var(--receita)"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="dash-table-wrap">
        <table className="dash-table serie-historica-table">
          <colgroup>
            <col className="col-mes" />
            <col className="col-saldo" />
            <col className="col-valorizacao" />
            <col className="col-rendimento" />
            <col className="col-dividendos" />
            <col className="col-aportes" />
            <col className="col-resgates" />
            <col className="col-confianca" />
          </colgroup>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Saldo</th>
              <th>Valorização</th>
              <th>Rendimento</th>
              <th>Dividendos</th>
              <th>Aportes</th>
              <th>Resgates</th>
              <th>Confiança</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((ponto) => (
              <tr key={ponto.ano_mes}>
                <td>{ponto.ano_mes}</td>
                <td>{formatCurrency(ponto.saldo)}</td>
                <td>{formatCurrency(ponto.valorizacao)}</td>
                <td>{formatCurrency(ponto.rendimento)}</td>
                <td>{formatCurrency(ponto.dividendos)}</td>
                <td>{formatCurrency(ponto.aportes)}</td>
                <td>{formatCurrency(ponto.resgates)}</td>
                <td>
                  <span className="tag">{ponto.confianca}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PosicaoHistorico({ investmentId }: { investmentId: number }) {
  const { data: transactions, isLoading, isError } = usePluggyInvestmentTransactions(investmentId);

  if (isLoading) return <p>Carregando...</p>;
  if (isError) return <p role="alert">Não foi possível carregar o histórico da posição.</p>;
  if (!transactions || transactions.length === 0) {
    return <p className="dash-empty">Nenhuma transação no histórico desta posição.</p>;
  }

  return (
    <table className="dash-table posicao-historico-table">
      <colgroup>
        <col className="col-data" />
        <col className="col-tipo" />
        <col className="col-descricao" />
        <col className="col-valor" />
      </colgroup>
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Descrição</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((transaction) => (
          <tr key={transaction.id}>
            <td>{transaction.data}</td>
            <td>{transaction.tipo}</td>
            <td>{transaction.descricao ?? "—"}</td>
            <td>{formatCurrency(transaction.valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
