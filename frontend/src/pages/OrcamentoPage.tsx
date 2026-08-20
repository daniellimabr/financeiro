import { useMemo, useState, type FormEvent } from "react";

import type { Orcamento, OrcamentoInput, OrcamentoTipo } from "../api/orcamentos";
import { CategoryCombobox } from "../components/CategoryCombobox";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useCreateOrcamento } from "../hooks/useCreateOrcamento";
import { useDeleteOrcamento } from "../hooks/useDeleteOrcamento";
import { useOrcamentos } from "../hooks/useOrcamentos";
import { useSubcategories } from "../hooks/useSubcategories";
import { useUpdateOrcamento } from "../hooks/useUpdateOrcamento";
import { subcategoryLabel } from "../utils/transactionEdit";
import { formatCurrency } from "../utils/format";

interface OrcamentoFormState {
  subcategoryId: number | undefined;
  tipo: OrcamentoTipo;
  valor: string;
  ano: string;
  mes: string;
  dataInicio: string;
  dataFim: string;
}

const EMPTY_FORM: OrcamentoFormState = {
  subcategoryId: undefined,
  tipo: "eventual",
  valor: "",
  ano: String(new Date().getFullYear()),
  mes: String(new Date().getMonth() + 1),
  dataInicio: "",
  dataFim: "",
};

function toInput(form: OrcamentoFormState): OrcamentoInput {
  return {
    subcategoryId: form.subcategoryId as number,
    tipo: form.tipo,
    valor: form.valor,
    ano: form.tipo === "eventual" ? Number(form.ano) : null,
    mes: form.tipo === "eventual" ? Number(form.mes) : null,
    dataInicio: form.tipo === "recorrente" ? form.dataInicio : null,
    dataFim: form.tipo === "recorrente" && form.dataFim ? form.dataFim : null,
  };
}

function descricaoVigencia(orcamento: Orcamento): string {
  if (orcamento.tipo === "eventual") {
    return `${orcamento.mes}/${orcamento.ano}`;
  }
  if (orcamento.data_fim) {
    return `${orcamento.data_inicio} até ${orcamento.data_fim}`;
  }
  return `a partir de ${orcamento.data_inicio}`;
}

export function OrcamentoPage() {
  const orcamentosQuery = useOrcamentos();
  const groupsQuery = useCategoryGroups();
  const subcategoriesQuery = useSubcategories();
  const createOrcamento = useCreateOrcamento();
  const updateOrcamento = useUpdateOrcamento();
  const deleteOrcamento = useDeleteOrcamento();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState<OrcamentoFormState>(EMPTY_FORM);

  const orcamentos = orcamentosQuery.data;
  const groups = groupsQuery.data;
  const subcategories = subcategoriesQuery.data;

  const grupos = useMemo(() => {
    const porSubcategoria = new Map<number, Orcamento[]>();
    for (const orcamento of orcamentos ?? []) {
      const lista = porSubcategoria.get(orcamento.subcategory_id) ?? [];
      lista.push(orcamento);
      porSubcategoria.set(orcamento.subcategory_id, lista);
    }
    return [...porSubcategoria.entries()]
      .map(([subcategoryId, itens]) => ({
        subcategoryId,
        label: subcategoryLabel(subcategoryId, subcategories, groups),
        itens,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [orcamentos, subcategories, groups]);

  function openCreateForm() {
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(orcamento: Orcamento) {
    setEditingId(orcamento.id);
    setFormState({
      subcategoryId: orcamento.subcategory_id,
      tipo: orcamento.tipo,
      valor: orcamento.valor,
      ano: orcamento.ano !== null ? String(orcamento.ano) : EMPTY_FORM.ano,
      mes: orcamento.mes !== null ? String(orcamento.mes) : EMPTY_FORM.mes,
      dataInicio: orcamento.data_inicio ?? "",
      dataFim: orcamento.data_fim ?? "",
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (formState.subcategoryId === undefined) return;
    const input = toInput(formState);
    if (editingId !== null) {
      updateOrcamento.mutate({ orcamentoId: editingId, input }, { onSuccess: closeForm });
    } else {
      createOrcamento.mutate(input, { onSuccess: closeForm });
    }
  }

  function handleDelete(orcamentoId: number, label: string) {
    if (window.confirm(`Excluir o orçamento de "${label}"?`)) {
      deleteOrcamento.mutate(orcamentoId);
    }
  }

  return (
    <section className="dash-page">
      <h2>Orçamento</h2>

      <div className="dash-filter">
        <button type="button" onClick={openCreateForm}>
          Novo orçamento
        </button>
      </div>

      {(createOrcamento.isError || updateOrcamento.isError) && (
        <p role="alert">Não foi possível salvar o orçamento.</p>
      )}
      {deleteOrcamento.isError && <p role="alert">Não foi possível excluir o orçamento.</p>}

      {formOpen && (
        <div role="dialog" aria-label={editingId !== null ? "Editar orçamento" : "Novo orçamento"}>
          <form className="dash-filter" onSubmit={submitForm}>
            <label>
              Subcategoria
              <CategoryCombobox
                groups={groups}
                subcategories={subcategories}
                value={formState.subcategoryId}
                onChange={(subcategoryId) => setFormState((prev) => ({ ...prev, subcategoryId }))}
                ariaLabel="Subcategoria do orçamento"
              />
            </label>

            <div className="dash-toggle" role="group" aria-label="Tipo de orçamento">
              <button
                type="button"
                aria-pressed={formState.tipo === "eventual"}
                onClick={() => setFormState((prev) => ({ ...prev, tipo: "eventual" }))}
              >
                Eventual
              </button>
              <button
                type="button"
                aria-pressed={formState.tipo === "recorrente"}
                onClick={() => setFormState((prev) => ({ ...prev, tipo: "recorrente" }))}
              >
                Recorrente
              </button>
            </div>

            <label>
              Valor
              <input
                aria-label="Valor"
                type="number"
                step="0.01"
                min="0.01"
                value={formState.valor}
                required
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, valor: event.target.value }))
                }
              />
            </label>

            {formState.tipo === "eventual" ? (
              <>
                <label>
                  Ano
                  <input
                    aria-label="Ano"
                    type="number"
                    value={formState.ano}
                    required
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, ano: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Mês
                  <input
                    aria-label="Mês"
                    type="number"
                    min="1"
                    max="12"
                    value={formState.mes}
                    required
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, mes: event.target.value }))
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Data de início
                  <input
                    aria-label="Data de início"
                    type="date"
                    value={formState.dataInicio}
                    required
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, dataInicio: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Data de fim (opcional)
                  <input
                    aria-label="Data de fim"
                    type="date"
                    value={formState.dataFim}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, dataFim: event.target.value }))
                    }
                  />
                </label>
              </>
            )}

            <button
              type="submit"
              disabled={
                createOrcamento.isPending ||
                updateOrcamento.isPending ||
                formState.subcategoryId === undefined
              }
            >
              Salvar
            </button>
            <button type="button" onClick={closeForm}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {orcamentosQuery.isLoading && <p>Carregando...</p>}
      {orcamentosQuery.isError && <p role="alert">Não foi possível carregar os orçamentos.</p>}
      {!orcamentosQuery.isLoading && grupos.length === 0 && (
        <p className="dash-empty">Nenhum orçamento cadastrado.</p>
      )}

      <ul className="simple-list">
        {grupos.map((grupo) => (
          <li key={grupo.subcategoryId}>
            <strong>{grupo.label}</strong>
            <ul className="simple-list">
              {grupo.itens.map((orcamento) => (
                <li key={orcamento.id}>
                  <span>{orcamento.tipo === "eventual" ? "Eventual" : "Recorrente"}</span>
                  <span>{descricaoVigencia(orcamento)}</span>
                  <span>{formatCurrency(orcamento.valor)}</span>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => openEditForm(orcamento)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn-ghost btn-quiet btn-danger"
                    type="button"
                    onClick={() => handleDelete(orcamento.id, grupo.label)}
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
