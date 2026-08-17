import { useMemo, useState, type FormEvent } from "react";

import type { Investimento, InvestimentoInput } from "../api/investimentos";
import type {
  PeriodoFilter,
  PeriodoHistorico,
  PontoTendencia,
  TransacaoTipo,
} from "../api/dashboards";
import { CardSparkline } from "../components/CardSparkline";
import { PeriodFilter } from "../components/PeriodFilter";
import { TransactionsTable } from "../components/TransactionsTable";
import { TrendChart } from "../components/TrendChart";
import { useCreateInvestimento } from "../hooks/useCreateInvestimento";
import { useDeleteInvestimento } from "../hooks/useDeleteInvestimento";
import { useInvestimentoEvolucao } from "../hooks/useInvestimentoEvolucao";
import { useInvestimentoGastos } from "../hooks/useInvestimentoGastos";
import { useInvestimentoGastosTendencia } from "../hooks/useInvestimentoGastosTendencia";
import { useInvestimentos } from "../hooks/useInvestimentos";
import { usePluggyAccounts } from "../hooks/usePluggyAccounts";
import { useUpdateInvestimento } from "../hooks/useUpdateInvestimento";
import { formatCurrency } from "../utils/format";

const EMPTY_FORM: InvestimentoInput = { nome: "" };

const PERIODO_HISTORICO: PeriodoHistorico = 6;

export function InvestimentosPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const filter: PeriodoFilter = { ano, mes };

  const [drillTipo, setDrillTipo] = useState<TransacaoTipo>("debito");

  const investimentosQuery = useInvestimentos();
  const { data: accounts } = usePluggyAccounts();
  const createInvestimento = useCreateInvestimento();
  const updateInvestimento = useUpdateInvestimento();
  const deleteInvestimento = useDeleteInvestimento();
  const tendenciaQuery = useInvestimentoGastosTendencia(drillTipo, ano, mes, PERIODO_HISTORICO);

  const [editingInvestimentoId, setEditingInvestimentoId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<InvestimentoInput>(EMPTY_FORM);

  const [selectedInvestimentoId, setSelectedInvestimentoId] = useState<number | null>(null);

  const investimentos = investimentosQuery.data ?? [];
  const selectedInvestimento =
    investimentos.find((investimento) => investimento.id === selectedInvestimentoId) ?? null;

  const trendByInvestimento = useMemo(() => {
    const map = new Map<number, PontoTendencia[]>();
    for (const item of tendenciaQuery.data ?? []) map.set(item.investimento_id, item.pontos);
    return map;
  }, [tendenciaQuery.data]);

  const trendColor = drillTipo === "credito" ? "var(--receita)" : "var(--despesa)";

  function carteirasDe(investimentoId: number) {
    return (accounts ?? []).filter((account) => account.investimento_id === investimentoId);
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
            carteiras={carteirasDe(investimento.id)}
            pontos={trendByInvestimento.get(investimento.id)}
            trendColor={trendColor}
            expanded={selectedInvestimentoId === investimento.id}
            onToggleDrilldown={() => toggleDrilldown(investimento.id)}
            onEdit={() => openEditForm(investimento)}
            onDelete={() => handleDelete(investimento.id, investimento.nome)}
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
          <InvestimentoDrilldown
            investimentoId={selectedInvestimento.id}
            tipo={drillTipo}
            filter={filter}
            pontos={trendByInvestimento.get(selectedInvestimento.id)}
          />
        </div>
      )}
    </section>
  );
}

function InvestimentoCard({
  investimento,
  carteiras,
  pontos,
  trendColor,
  expanded,
  onToggleDrilldown,
  onEdit,
  onDelete,
}: {
  investimento: Investimento;
  carteiras: { id: number; apelido: string | null; nome: string }[];
  pontos: PontoTendencia[] | undefined;
  trendColor: string;
  expanded: boolean;
  onToggleDrilldown: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
      <span className="tag">
        {carteiras.length === 0
          ? "Nenhuma carteira vinculada"
          : `Carteiras: ${carteiras.map((c) => c.apelido ?? c.nome).join(", ")}`}
      </span>
      <CardSparkline pontos={pontos} color={trendColor} />
      <div className="dash-filter">
        <button type="button" aria-expanded={expanded} onClick={onToggleDrilldown}>
          {expanded ? "Fechar extrato" : "Ver extrato no período"}
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
}: {
  investimentoId: number;
  tipo: TransacaoTipo;
  filter: PeriodoFilter;
  pontos: PontoTendencia[] | undefined;
}) {
  const gastosQuery = useInvestimentoGastos(tipo, filter);

  const total =
    gastosQuery.data?.find((item) => item.investimento_id === investimentoId)?.total ?? "0";
  const color = tipo === "credito" ? "var(--receita)" : "var(--despesa)";
  const rotulo = tipo === "credito" ? "Resgate" : "Aporte";

  if (gastosQuery.isLoading) return <p>Carregando...</p>;
  if (gastosQuery.isError) {
    return <p role="alert">Não foi possível carregar o extrato do investimento.</p>;
  }

  return (
    <>
      {pontos && pontos.length > 1 && <TrendChart pontos={pontos} color={color} />}
      <p>
        {rotulo} no período: <strong style={{ color }}>{formatCurrency(total)}</strong>
      </p>
      <TransactionsTable
        filter={filter}
        investimentoId={investimentoId}
        tipo={tipo}
        showAtivo={false}
        showInvestimento={false}
        emptyMessage="Nenhuma transação vinculada neste período."
      />
    </>
  );
}
