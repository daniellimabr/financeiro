import { Fragment, useMemo, useState, type FormEvent } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type {
  PeriodoFilter,
  PeriodoHistorico,
  PontoTendencia,
  TransacaoTipo,
} from "../api/dashboards";
import type { EvolucaoMensal, Investimento, InvestimentoInput } from "../api/investimentos";
import type { PluggyInvestment } from "../api/pluggy";
import { KpiTile } from "../components/KpiTile";
import type { KpiDelta } from "../components/KpiTile";
import { MonthNav } from "../components/MonthNav";
import { TrendLineChart } from "../components/TrendLineChart";
import { useCreateInvestimento } from "../hooks/useCreateInvestimento";
import { useDeleteInvestimento } from "../hooks/useDeleteInvestimento";
import { useEvolucaoMensal } from "../hooks/useEvolucaoMensal";
import { useEvolucaoMensalConsolidada } from "../hooks/useEvolucaoMensalConsolidada";
import {
  montarSeriePorInvestimento,
  useEvolucaoMensalPorInvestimento,
} from "../hooks/useEvolucaoMensalPorInvestimento";
import { useInvestimentoEvolucao } from "../hooks/useInvestimentoEvolucao";
import { useInvestimentoGastos } from "../hooks/useInvestimentoGastos";
import { useInvestimentoGastosTendencia } from "../hooks/useInvestimentoGastosTendencia";
import { useInvestimentos } from "../hooks/useInvestimentos";
import { useInvestimentoTransacoes } from "../hooks/useInvestimentoTransacoes";
import { usePluggyInvestments } from "../hooks/usePluggyInvestments";
import { usePluggyInvestmentTransactions } from "../hooks/usePluggyInvestmentTransactions";
import { useUpdateInvestimento } from "../hooks/useUpdateInvestimento";
import { formatCurrency } from "../utils/format";
import {
  encontrarMesEAnterior,
  evolucaoMensalParaPontos,
  temMesReconstruido,
} from "../utils/investimentosConsolidado";

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

  // Série mensal (holdings) por investimento (Sprint 36, PRD-036b) — fonte
  // única pro sparkline de cada tile de entrada e pro ranking "Desempenho no
  // mês"; mesma queryKey de useEvolucaoMensal, cache compartilhado.
  const serieQueries = useEvolucaoMensalPorInvestimento(investimentos);
  const serieByInvestimento = montarSeriePorInvestimento(investimentos, serieQueries);

  // Evolução mensal consolidada (soma de todos os investimentos do usuário,
  // Sprint 36/PRD-036b) — alimenta os 4 KPIs e o gráfico "Evolução do
  // patrimônio". Mesma limitação já aceita na Série histórica individual
  // (Sprint 21): só holdings via Pluggy têm snapshot mensal, contas
  // bancárias vinculadas não — por isso o valor aqui pode diferir da soma de
  // `valor_atual` (contas + holdings) mostrada em cada tile de entrada
  // abaixo, que continua exata.
  const consolidadaQuery = useEvolucaoMensalConsolidada();
  const serieConsolidada = consolidadaQuery.data ?? [];
  const { atual: consolidadoAtual, anterior: consolidadoAnterior } = encontrarMesEAnterior(
    serieConsolidada,
    ano,
    mes
  );
  const janelaConsolidada = serieConsolidada.slice(-PERIODO_HISTORICO);
  const consolidadoTemReconstruido = temMesReconstruido(janelaConsolidada);

  function buildConsolidadoDelta(
    campo: keyof Pick<EvolucaoMensal, "saldo" | "rendimento" | "aportes" | "resgates">,
    positiveIsGood: boolean
  ): KpiDelta | undefined {
    if (!consolidadoAtual || !consolidadoAnterior) return undefined;
    return {
      mode: "percent",
      current: Number(consolidadoAtual[campo]),
      previous: Number(consolidadoAnterior[campo]),
      positiveIsGood,
    };
  }

  // Não memoizado: `investimentos`/`serieByInvestimento` já são recriados a
  // cada render (dados de useQuery/useQueries), então um useMemo aqui não
  // memoizaria de verdade — só complicaria o array de dependências.
  const ranking = investimentos
    .map((investimento) => {
      const serie = serieByInvestimento.get(investimento.id) ?? [];
      const { atual } = encontrarMesEAnterior(serie, ano, mes);
      if (!atual) return null;
      return {
        id: investimento.id,
        nome: investimento.nome,
        rendimento: atual.rendimento,
        confianca: atual.confianca,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => Number(b.rendimento) - Number(a.rendimento));

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
        </div>
        <button type="button" className="ac-btn ac-btn-primary" onClick={openCreateForm}>
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
          className="ac-panel"
          aria-label={editingInvestimentoId !== null ? "Editar investimento" : "Novo investimento"}
        >
          <form className="ac-form-row" onSubmit={submitForm}>
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
            <div className="ac-btn-row">
              <button
                type="submit"
                className="ac-btn ac-btn-primary"
                disabled={createInvestimento.isPending || updateInvestimento.isPending}
              >
                Salvar
              </button>
              <button type="button" className="ac-btn ac-btn-ghost" onClick={closeForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {investimentosQuery.isLoading && <p>Carregando...</p>}
      {investimentosQuery.isError && (
        <p role="alert">Não foi possível carregar os investimentos.</p>
      )}
      {!investimentosQuery.isLoading && investimentos.length === 0 && (
        <p className="ac-empty">Nenhum investimento cadastrado.</p>
      )}

      {investimentos.length > 0 && (
        <>
          <div className="ac-section-label">Consolidado</div>
          <div className="ac-kpi-row">
            <KpiTile
              label="Patrimônio Investido"
              value={formatCurrency(consolidadoAtual?.saldo)}
              delta={buildConsolidadoDelta("saldo", true)}
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={evolucaoMensalParaPontos(janelaConsolidada, "saldo")}
                  color="var(--ac-blue)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
            <KpiTile
              label="Rendimento do Mês"
              value={formatCurrency(consolidadoAtual?.rendimento)}
              delta={buildConsolidadoDelta("rendimento", true)}
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={evolucaoMensalParaPontos(janelaConsolidada, "rendimento")}
                  color="var(--ac-good)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
            <KpiTile
              label="Aportes"
              value={formatCurrency(consolidadoAtual?.aportes)}
              delta={buildConsolidadoDelta("aportes", true)}
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={evolucaoMensalParaPontos(janelaConsolidada, "aportes")}
                  color="var(--ac-text-dim)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
            <KpiTile
              label="Resgates"
              value={formatCurrency(consolidadoAtual?.resgates)}
              delta={buildConsolidadoDelta("resgates", false)}
              sparkline={
                <TrendLineChart
                  variant="spark"
                  pontos={evolucaoMensalParaPontos(janelaConsolidada, "resgates")}
                  color="var(--ac-text-dim)"
                  onSelecionarMes={selecionarMes}
                />
              }
            />
          </div>

          <div className="ac-two-col">
            <div className="ac-panel">
              <div className="ac-panel-head">
                <div>
                  <h2>Evolução do patrimônio — últimos {PERIODO_HISTORICO} meses</h2>
                  <div className="ac-panel-meta">
                    Soma dos investimentos com holdings sincronizadas via Pluggy — investimentos só
                    com carteira bancária vinculada ainda não têm histórico mensal.
                  </div>
                </div>
                {consolidadoTemReconstruido && (
                  <span
                    className="ac-kpi-badge"
                    style={{ color: "var(--ac-amber)", background: "var(--ac-amber-bg)" }}
                  >
                    Contém mês reconstruído
                  </span>
                )}
              </div>
              {janelaConsolidada.length > 1 ? (
                <TrendLineChart
                  variant="card"
                  pontos={evolucaoMensalParaPontos(janelaConsolidada, "saldo")}
                  color="var(--ac-blue)"
                  onSelecionarMes={selecionarMes}
                />
              ) : (
                <p className="ac-empty">Sem histórico mensal suficiente ainda.</p>
              )}
            </div>

            <div className="ac-panel">
              <div className="ac-panel-head">
                <div>
                  <h2>Desempenho no mês</h2>
                  <div className="ac-panel-meta">
                    Rendimento de cada investimento no mês filtrado, do maior pro menor.
                  </div>
                </div>
              </div>
              {ranking.length > 0 ? (
                <div className="ac-table-wrap">
                  <table className="ac-table">
                    <colgroup>
                      <col style={{ width: "46%" }} />
                      <col />
                      <col style={{ width: "22%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Investimento</th>
                        <th>Rendimento</th>
                        <th>Confiança</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((item) => (
                        <tr key={item.id}>
                          <td>{item.nome}</td>
                          <td
                            style={{
                              color:
                                Number(item.rendimento) >= 0 ? "var(--ac-good)" : "var(--ac-bad)",
                            }}
                          >
                            {formatCurrency(item.rendimento)}
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: 10.5,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                color:
                                  item.confianca === "reconstruido"
                                    ? "var(--ac-amber)"
                                    : "var(--ac-text-dim)",
                              }}
                            >
                              {item.confianca === "reconstruido" ? "Reconstruído" : "Real"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="ac-empty">Nenhum investimento com snapshot neste mês ainda.</p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="ac-section-label">Investimentos</div>
      <div className="ac-kpi-grid">
        {investimentos.map((investimento) => (
          <InvestimentoEntryTile
            key={investimento.id}
            investimento={investimento}
            pontosSaldo={evolucaoMensalParaPontos(
              serieByInvestimento.get(investimento.id) ?? [],
              "saldo"
            )}
            expanded={selectedInvestimentoId === investimento.id}
            onToggle={() => toggleDrilldown(investimento.id)}
          />
        ))}
      </div>

      {selectedInvestimento && (
        <div className="dash-funnel">
          <div className="dash-funnel-head">
            <h2>{selectedInvestimento.nome}</h2>
            <div className="dash-filter">
              <button
                className="btn-ghost"
                type="button"
                onClick={() => openEditForm(selectedInvestimento)}
              >
                Editar
              </button>
              <button
                className="btn-ghost btn-quiet btn-danger"
                type="button"
                onClick={() => handleDelete(selectedInvestimento.id, selectedInvestimento.nome)}
              >
                Excluir
              </button>
              <button
                type="button"
                className="dash-back"
                onClick={() => setSelectedInvestimentoId(null)}
              >
                Fechar
              </button>
            </div>
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
            <>
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
              <InvestimentoDrilldown
                investimentoId={selectedInvestimento.id}
                tipo={drillTipo}
                filter={filter}
                pontos={trendByInvestimento.get(selectedInvestimento.id)}
                onSelecionarMes={selecionarMes}
              />
            </>
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

// Tile de entrada de cada investimento (Sprint 36, PRD-036b) — reaproveita
// KpiTile diretamente em vez de um card novo (PRD-036b restringe
// explicitamente a inventar componentes específicos desta tela). Valor e
// legenda de rendimento vêm de useInvestimentoEvolucao (tempo real, contas +
// holdings — mesma fonte que o card antigo já usava), só o sparkline muda de
// fonte (evolução mensal em vez de tendência de aporte/resgate).
function InvestimentoEntryTile({
  investimento,
  pontosSaldo,
  expanded,
  onToggle,
}: {
  investimento: Investimento;
  pontosSaldo: PontoTendencia[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const evolucaoQuery = useInvestimentoEvolucao(investimento.id);
  const evolucao = evolucaoQuery.data;

  return (
    <KpiTile
      label={investimento.nome}
      value={evolucao ? formatCurrency(evolucao.saldo_atual) : "—"}
      caption={
        evolucao
          ? `Rendimento estimado: ${formatCurrency(evolucao.rendimento_estimado)}`
          : undefined
      }
      sparkline={<TrendLineChart variant="spark" pontos={pontosSaldo} color="var(--ac-blue)" />}
      ariaExpanded={expanded}
      onClick={onToggle}
    />
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
