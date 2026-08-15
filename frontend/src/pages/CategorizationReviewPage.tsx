import { useMemo, useState } from "react";

import type { CategorizationStatus, TransactionTipo } from "../api/categorization";
import { CategoryCombobox } from "../components/CategoryCombobox";
import { PeriodFilter } from "../components/PeriodFilter";
import { StatusIcon } from "../components/StatusIcon";
import { AssetSelectCell, DescriptionCell } from "../components/TransactionEditCells";
import { TransactionTipoIcon } from "../components/TransactionTipoIcon";
import { useAssets } from "../hooks/useAssets";
import { useBulkConfirmCategorization } from "../hooks/useBulkConfirmCategorization";
import { useCategorizationTransactions } from "../hooks/useCategorizationTransactions";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useSetCategory } from "../hooks/useSetCategory";
import { useSubcategories } from "../hooks/useSubcategories";
import { formatCurrency } from "../utils/format";
import { descricaoExibida } from "../utils/transactionEdit";

const PAGE_SIZE = 20;

type HasAssetFilter = "todos" | "sim" | "nao";

export function CategorizationReviewPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [status, setStatus] = useState<CategorizationStatus>("pendente");
  const [tipo, setTipo] = useState<TransactionTipo | "todos">("todos");
  const [hasAssetFilter, setHasAssetFilter] = useState<HasAssetFilter>("todos");
  const [groupId, setGroupId] = useState<number | "todos">("todos");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCategorizationTransactions({
    ano,
    mes,
    status,
    tipo: tipo === "todos" ? undefined : tipo,
    hasAsset: hasAssetFilter === "todos" ? undefined : hasAssetFilter === "sim",
    groupId: groupId === "todos" ? undefined : groupId,
    page,
    pageSize: PAGE_SIZE,
  });
  const items = data?.items;
  const { data: groups } = useCategoryGroups();
  const { data: subcategories } = useSubcategories();
  const { data: assets } = useAssets();
  const setCategory = useSetCategory();
  const bulkConfirm = useBulkConfirmCategorization();

  const [selectedSubcategory, setSelectedSubcategory] = useState<
    Record<number, number | undefined>
  >({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const pendentesDaPagina = useMemo(
    () => (items ?? []).filter((tx) => tx.categorizacao_status === "pendente"),
    [items]
  );
  const suggestionCount = (items ?? []).filter((tx) => tx.descricao_sugerida !== null).length;

  function mudarFiltro(overrides: {
    ano?: number;
    mes?: number;
    status?: CategorizationStatus;
    tipo?: TransactionTipo | "todos";
    hasAssetFilter?: HasAssetFilter;
    groupId?: number | "todos";
  }) {
    if (overrides.ano !== undefined) setAno(overrides.ano);
    if (overrides.mes !== undefined) setMes(overrides.mes);
    if (overrides.status !== undefined) setStatus(overrides.status);
    if (overrides.tipo !== undefined) setTipo(overrides.tipo);
    if (overrides.hasAssetFilter !== undefined) setHasAssetFilter(overrides.hasAssetFilter);
    if (overrides.groupId !== undefined) setGroupId(overrides.groupId);
    setPage(1);
    setChecked({});
  }

  const allPendentesChecked =
    pendentesDaPagina.length > 0 && pendentesDaPagina.every((tx) => checked[tx.id]);

  function toggleAllPendentes() {
    const next = !allPendentesChecked;
    setChecked((prev) => {
      const updated = { ...prev };
      for (const tx of pendentesDaPagina) updated[tx.id] = next;
      return updated;
    });
  }

  function aprovarMarcadas() {
    const marcadas = pendentesDaPagina.filter((tx) => checked[tx.id]);
    const itemsToConfirm = marcadas
      .map((tx) => {
        const subcategoryId = selectedSubcategory[tx.id] ?? tx.subcategoria_sugerida_id;
        return subcategoryId ? { transactionId: tx.id, subcategoryId } : null;
      })
      .filter((item): item is { transactionId: number; subcategoryId: number } => item !== null);
    if (itemsToConfirm.length === 0) return;
    bulkConfirm.mutate(itemsToConfirm, {
      onSuccess: () => setChecked({}),
    });
  }

  const marcadasParaAprovar = pendentesDaPagina.filter(
    (tx) => checked[tx.id] && (selectedSubcategory[tx.id] ?? tx.subcategoria_sugerida_id)
  ).length;

  return (
    <section className="dash-page">
      <h2>Categorização</h2>

      <div className="dash-filter">
        <PeriodFilter ano={ano} mes={mes} onChange={mudarFiltro} />
        <label>
          Tipo
          <select
            aria-label="Tipo"
            value={tipo}
            onChange={(event) =>
              mudarFiltro({ tipo: event.target.value as TransactionTipo | "todos" })
            }
          >
            <option value="todos">Todos</option>
            <option value="debito">Despesa</option>
            <option value="credito">Receita</option>
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            value={status}
            onChange={(event) =>
              mudarFiltro({ status: event.target.value as CategorizationStatus })
            }
          >
            <option value="pendente">Pendentes</option>
            <option value="confirmada">Confirmadas</option>
            <option value="todas">Todas</option>
          </select>
        </label>
        <label>
          Associado a ativo
          <select
            aria-label="Associado a ativo"
            value={hasAssetFilter}
            onChange={(event) =>
              mudarFiltro({ hasAssetFilter: event.target.value as HasAssetFilter })
            }
          >
            <option value="todos">Todos</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </label>
        <label>
          Categoria
          <select
            aria-label="Categoria"
            value={groupId}
            onChange={(event) =>
              mudarFiltro({
                groupId: event.target.value === "todos" ? "todos" : Number(event.target.value),
              })
            }
          >
            <option value="todos">Todas</option>
            {groups?.map((group) => (
              <option key={group.id} value={group.id}>
                {group.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p>Carregando...</p>}
      {data && data.total === 0 && <p>Nenhuma transação encontrada.</p>}
      {setCategory.isError && <p role="alert">Não foi possível confirmar a categoria.</p>}
      {suggestionCount > 0 && (
        <p>
          {suggestionCount} {suggestionCount === 1 ? "item" : "itens"} com sugestão de descrição
          pendente.
        </p>
      )}

      {pendentesDaPagina.length > 0 && (
        <div className="dash-filter">
          <button type="button" onClick={aprovarMarcadas} disabled={marcadasParaAprovar === 0}>
            Aprovar marcadas ({marcadasParaAprovar})
          </button>
        </div>
      )}

      <div className="dash-table-wrap">
        <table className="dash-table cat-review-table">
          <thead>
            <tr>
              <th>
                {pendentesDaPagina.length > 0 && (
                  <input
                    type="checkbox"
                    aria-label="Marcar todas as pendentes"
                    checked={allPendentesChecked}
                    onChange={toggleAllPendentes}
                  />
                )}
              </th>
              <th>Status</th>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Ativo</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items?.map((tx) => {
              const isPendente = tx.categorizacao_status === "pendente";
              const subcategoryValue =
                selectedSubcategory[tx.id] ??
                tx.subcategoria_sugerida_id ??
                tx.subcategory_id ??
                undefined;
              const exibida = descricaoExibida(tx);

              return (
                <tr key={tx.id}>
                  <td>
                    {isPendente && (
                      <input
                        type="checkbox"
                        aria-label={`Marcar ${exibida}`}
                        checked={checked[tx.id] ?? false}
                        onChange={(event) =>
                          setChecked((prev) => ({ ...prev, [tx.id]: event.target.checked }))
                        }
                      />
                    )}
                  </td>
                  <td>
                    <StatusIcon pending={isPendente} />
                  </td>
                  <td>{tx.data}</td>
                  <td>
                    <DescriptionCell transaction={tx} />
                  </td>
                  <td>
                    <CategoryCombobox
                      ariaLabel={`Categoria de ${exibida}`}
                      groups={groups}
                      subcategories={subcategories}
                      value={subcategoryValue}
                      onChange={(subcategoryId) => {
                        setSelectedSubcategory((prev) => ({ ...prev, [tx.id]: subcategoryId }));
                        if (!isPendente) {
                          setCategory.mutate({ transactionId: tx.id, subcategoryId });
                        }
                      }}
                    />
                  </td>
                  <td>
                    <AssetSelectCell transaction={tx} assets={assets} />
                  </td>
                  <td>
                    <span className="valor-cell">
                      <TransactionTipoIcon tipo={tx.tipo} />
                      {formatCurrency(tx.valor)}
                    </span>
                  </td>
                  <td>
                    {isPendente && (
                      <button
                        onClick={() => {
                          if (subcategoryValue === undefined) return;
                          setCategory.mutate({
                            transactionId: tx.id,
                            subcategoryId: subcategoryValue,
                          });
                        }}
                        disabled={subcategoryValue === undefined || setCategory.isPending}
                      >
                        Confirmar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="dash-filter">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            ← Anterior
          </button>
          <span>
            Página {page} de {totalPaginas} ({data.total} transações)
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPaginas, current + 1))}
            disabled={page >= totalPaginas}
          >
            Próxima →
          </button>
        </div>
      )}
    </section>
  );
}
