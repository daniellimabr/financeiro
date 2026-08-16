import type { PeriodoFilter, TransacaoTipo } from "../api/dashboards";
import type { PluggyTransaction } from "../api/pluggy";
import { useAssets } from "../hooks/useAssets";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { usePluggyTransactions } from "../hooks/usePluggyTransactions";
import { useSubcategories } from "../hooks/useSubcategories";
import { useTableSort } from "../hooks/useTableSort";
import { formatCurrency } from "../utils/format";
import { AccountTipoIcon } from "./AccountTipoIcon";
import { AssetSelectCell, CategorySelectCell, DescriptionCell } from "./TransactionEditCells";

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

type TransacaoSortKey = "data" | "descricao" | "valor" | "percentual";

// Tabela de transação unificada (Sprint 13) — substitui as 3 implementações
// divergentes que existiam antes (TransacoesPanel em Dashboard/Natureza,
// AssetDrilldown, LiabilityDrilldown). Cada consumidor mantém sua própria
// query (via filter/categoriaId/assetId/liabilityId/tipo) — não recebe a
// lista de transações já pronta, mesmo contrato que TransacoesPanel já
// tinha. showCategoria/showAtivo escondem colunas que não fazem sentido no
// contexto do consumidor (ex.: AssetDrilldown já está escopado a um único
// ativo, então a coluna Ativo seria sempre o mesmo valor).
export function TransactionsTable({
  filter,
  categoriaId,
  assetId,
  liabilityId,
  tipo,
  totalParaPercentual,
  emptyMessage,
  showCategoria = true,
  showAtivo = true,
}: {
  filter: PeriodoFilter;
  categoriaId?: number;
  assetId?: number;
  liabilityId?: number;
  tipo?: TransacaoTipo;
  totalParaPercentual?: string;
  emptyMessage: string;
  showCategoria?: boolean;
  showAtivo?: boolean;
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
  const { data: subcategories } = useSubcategories();
  const { data: groups } = useCategoryGroups();
  const { data: assets } = useAssets();
  const data = query.data ?? [];
  const total = totalParaPercentual !== undefined ? Number(totalParaPercentual) : undefined;

  const { sorted, sortKey, direction, toggleSort } = useTableSort<
    PluggyTransaction,
    TransacaoSortKey
  >(
    data,
    (item, key) => {
      switch (key) {
        case "valor":
          return Number(item.valor);
        case "percentual":
          return total !== undefined && total > 0 ? Math.abs(Number(item.valor)) / total : 0;
        case "data":
          return item.data;
        case "descricao":
          return item.descricao;
      }
    },
    "data",
    "desc"
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as transações.</p>;
  if (data.length === 0) return <p className="dash-empty">{emptyMessage}</p>;

  return (
    <div className="dash-table-wrap">
      <table className="dash-table">
        <thead>
          <tr>
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
            {showCategoria && <th>Categoria</th>}
            {showAtivo && <th>Ativo</th>}
            <SortableHeader
              label="Valor"
              sortKeyName="valor"
              currentKey={sortKey}
              direction={direction}
              onClick={() => toggleSort("valor")}
            />
            {total !== undefined && (
              <SortableHeader
                label="%"
                sortKeyName="percentual"
                currentKey={sortKey}
                direction={direction}
                onClick={() => toggleSort("percentual")}
              />
            )}
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
                <td>{transaction.data}</td>
                <td>
                  <DescriptionCell transaction={transaction} />
                </td>
                {showCategoria && (
                  <td>
                    <CategorySelectCell
                      transaction={transaction}
                      subcategories={subcategories}
                      groups={groups}
                    />
                  </td>
                )}
                {showAtivo && (
                  <td>
                    <AssetSelectCell transaction={transaction} assets={assets} />
                  </td>
                )}
                <td>
                  <span className="valor-cell">
                    <AccountTipoIcon tipo={transaction.account_tipo} />
                    {formatCurrency(transaction.valor)}
                  </span>
                </td>
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
