import { useMemo, useState, type FormEvent } from "react";

import type { Liability, LiabilityInput, LiabilityTipo } from "../api/liabilities";
import type { PeriodoFilter, PontoTendencia, Regime } from "../api/dashboards";
import { PeriodFilter } from "../components/PeriodFilter";
import { RegimeToggle } from "../components/RegimeToggle";
import { TransactionsTable } from "../components/TransactionsTable";
import { TrendLineChart } from "../components/TrendLineChart";
import { useCreateLiability } from "../hooks/useCreateLiability";
import { useDeleteLiability } from "../hooks/useDeleteLiability";
import { useLiabilities } from "../hooks/useLiabilities";
import { useLiabilityGastos } from "../hooks/useLiabilityGastos";
import { useLiabilityGastosTendencia } from "../hooks/useLiabilityGastosTendencia";
import { useSettleLiability } from "../hooks/useSettleLiability";
import { useUpdateLiability } from "../hooks/useUpdateLiability";
import { formatCurrency } from "../utils/format";

const TIPO_LABEL: Record<string, string> = {
  financiamento: "Financiamento",
  outro: "Outro",
};

const EMPTY_FORM: LiabilityInput = {
  nome: "",
  tipo: "outro",
  valorTotal: "",
  saldoDevedor: "",
};

const PERIODO_HISTORICO = 6;

export function LiabilitiesPage() {
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

  const [regime, setRegime] = useState<Regime>("competencia");

  const liabilitiesQuery = useLiabilities();
  const createLiability = useCreateLiability();
  const updateLiability = useUpdateLiability();
  const settleLiability = useSettleLiability();
  const deleteLiability = useDeleteLiability();
  const tendenciaQuery = useLiabilityGastosTendencia(ano, mes, PERIODO_HISTORICO, regime);

  const [editingLiabilityId, setEditingLiabilityId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<LiabilityInput>(EMPTY_FORM);

  const [selectedLiabilityId, setSelectedLiabilityId] = useState<number | null>(null);

  const liabilities = liabilitiesQuery.data ?? [];
  const ativos = liabilities.filter((liability) => liability.status === "ativo");
  const quitados = liabilities.filter((liability) => liability.status === "quitado");
  const selectedLiability = liabilities.find((l) => l.id === selectedLiabilityId) ?? null;

  const trendByLiability = useMemo(() => {
    const map = new Map<number, PontoTendencia[]>();
    for (const item of tendenciaQuery.data ?? []) map.set(item.liability_id, item.pontos);
    return map;
  }, [tendenciaQuery.data]);

  function openCreateForm() {
    setEditingLiabilityId(null);
    setFormState(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(liability: Liability) {
    setEditingLiabilityId(liability.id);
    setFormState({
      nome: liability.nome,
      tipo: liability.tipo as LiabilityTipo,
      valorTotal: liability.valor_total,
      saldoDevedor: liability.saldo_devedor,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (editingLiabilityId !== null) {
      updateLiability.mutate(
        { liabilityId: editingLiabilityId, input: formState },
        { onSuccess: closeForm }
      );
    } else {
      createLiability.mutate(formState, { onSuccess: closeForm });
    }
  }

  function handleSettle(liabilityId: number, nome: string) {
    if (window.confirm(`Quitar "${nome}"?`)) {
      settleLiability.mutate(liabilityId);
    }
  }

  function handleDelete(liabilityId: number, nome: string) {
    if (
      window.confirm(
        `Excluir "${nome}"? Transações vinculadas não são excluídas, só desassociadas.`
      )
    ) {
      deleteLiability.mutate(liabilityId);
      if (selectedLiabilityId === liabilityId) setSelectedLiabilityId(null);
    }
  }

  function toggleDrilldown(liabilityId: number) {
    setSelectedLiabilityId((prev) => (prev === liabilityId ? null : liabilityId));
  }

  return (
    <section className="dash-page">
      <h2>Passivos</h2>

      <div className="dash-filter">
        <PeriodFilter
          ano={ano}
          mes={mes}
          onChange={(next) => {
            if (next.ano !== undefined) setAno(next.ano);
            if (next.mes !== undefined) setMes(next.mes);
          }}
        />
        <RegimeToggle value={regime} onChange={setRegime} />
        <button type="button" onClick={openCreateForm}>
          Novo passivo
        </button>
      </div>

      {(createLiability.isError || updateLiability.isError) && (
        <p role="alert">Não foi possível salvar o passivo.</p>
      )}
      {settleLiability.isError && <p role="alert">Não foi possível quitar o passivo.</p>}
      {deleteLiability.isError && <p role="alert">Não foi possível excluir o passivo.</p>}

      {formOpen && (
        <div
          role="dialog"
          aria-label={editingLiabilityId !== null ? "Editar passivo" : "Novo passivo"}
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
            <label>
              Tipo
              <select
                aria-label="Tipo do passivo"
                value={formState.tipo}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, tipo: event.target.value as LiabilityTipo }))
                }
              >
                <option value="financiamento">Financiamento</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              Valor total
              <input
                aria-label="Valor total"
                type="number"
                step="0.01"
                min="0"
                value={formState.valorTotal}
                required
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, valorTotal: event.target.value }))
                }
              />
            </label>
            <label>
              Saldo devedor
              <input
                aria-label="Saldo devedor"
                type="number"
                step="0.01"
                min="0"
                value={formState.saldoDevedor}
                required
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, saldoDevedor: event.target.value }))
                }
              />
            </label>
            <button type="submit" disabled={createLiability.isPending || updateLiability.isPending}>
              Salvar
            </button>
            <button type="button" onClick={closeForm}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {liabilitiesQuery.isLoading && <p>Carregando...</p>}
      {liabilitiesQuery.isError && <p role="alert">Não foi possível carregar os passivos.</p>}
      {!liabilitiesQuery.isLoading && ativos.length === 0 && (
        <p className="dash-empty">Nenhum passivo cadastrado.</p>
      )}

      <div className="dash-summary">
        {ativos.map((liability) => (
          <div key={liability.id} className="dash-tile">
            <span className="k">{TIPO_LABEL[liability.tipo] ?? liability.tipo}</span>
            <span className="v">{formatCurrency(liability.saldo_devedor)}</span>
            <strong>{liability.nome}</strong>
            <span className="tag">Total: {formatCurrency(liability.valor_total)}</span>
            <TrendLineChart
              variant="spark"
              pontos={trendByLiability.get(liability.id)}
              color="var(--despesa)"
              onSelecionarMes={selecionarMes}
            />
            <div className="dash-filter">
              <button
                type="button"
                aria-expanded={selectedLiabilityId === liability.id}
                onClick={() => toggleDrilldown(liability.id)}
              >
                {selectedLiabilityId === liability.id ? "Fechar gasto" : "Ver gasto no período"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => openEditForm(liability)}>
                Editar
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => handleSettle(liability.id, liability.nome)}
              >
                Quitar
              </button>
              <button
                className="btn-ghost btn-quiet btn-danger"
                type="button"
                onClick={() => handleDelete(liability.id, liability.nome)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedLiability && (
        <div className="dash-funnel">
          <div className="dash-funnel-head">
            <h2>{selectedLiability.nome}</h2>
            <button
              type="button"
              className="dash-back"
              onClick={() => setSelectedLiabilityId(null)}
            >
              Fechar
            </button>
          </div>
          <LiabilityDrilldown
            liabilityId={selectedLiability.id}
            filter={filter}
            regime={regime}
            pontos={trendByLiability.get(selectedLiability.id)}
            onSelecionarMes={selecionarMes}
          />
        </div>
      )}

      <h3>Quitados</h3>
      {quitados.length === 0 ? (
        <p className="dash-empty">Nenhum passivo quitado.</p>
      ) : (
        <div className="dash-summary">
          {quitados.map((liability) => (
            <div key={liability.id} className="dash-tile baixado">
              <span className="k">{TIPO_LABEL[liability.tipo] ?? liability.tipo}</span>
              <span className="v">{formatCurrency(liability.valor_total)}</span>
              <strong>{liability.nome}</strong>
              <span className="tag">Quitado em {liability.data_quitacao}</span>
              <div className="dash-filter">
                <button
                  className="btn-ghost btn-quiet btn-danger"
                  type="button"
                  onClick={() => handleDelete(liability.id, liability.nome)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LiabilityDrilldown({
  liabilityId,
  filter,
  regime,
  pontos,
  onSelecionarMes,
}: {
  liabilityId: number;
  filter: PeriodoFilter;
  regime: Regime;
  pontos: PontoTendencia[] | undefined;
  onSelecionarMes: (ponto: { ano: number; mes: number }) => void;
}) {
  const gastosQuery = useLiabilityGastos({ ...filter, regime });

  const total = gastosQuery.data?.find((item) => item.liability_id === liabilityId)?.total ?? "0";
  const color = "var(--despesa)";

  if (gastosQuery.isLoading) return <p>Carregando...</p>;
  if (gastosQuery.isError) {
    return <p role="alert">Não foi possível carregar o gasto do passivo.</p>;
  }

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
      <p>
        Gasto no período: <strong style={{ color }}>{formatCurrency(total)}</strong>
      </p>
      <TransactionsTable
        filter={filter}
        liabilityId={liabilityId}
        tipo="debito"
        emptyMessage="Nenhuma transação vinculada neste período."
      />
    </>
  );
}
