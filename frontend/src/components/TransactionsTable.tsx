import type { PeriodoFilter, TransacaoTipo } from "../api/dashboards";
import type { PluggyTransaction } from "../api/pluggy";
import { useAssets } from "../hooks/useAssets";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useInvestimentos } from "../hooks/useInvestimentos";
import { usePluggyTransactions } from "../hooks/usePluggyTransactions";
import { useSubcategories } from "../hooks/useSubcategories";
import { useTableSort } from "../hooks/useTableSort";
import { formatCurrency } from "../utils/format";
import { assetLabel, investimentoLabel, subcategoryLabel } from "../utils/transactionEdit";
import { AccountTipoIcon } from "./AccountTipoIcon";
import { BinocularIcon } from "./BinocularIcon";
import { DirectionIcon } from "./DirectionIcon";
import { SortableHeader } from "./SortableHeader";
import {
  AssetSelectCell,
  CategorySelectCell,
  DescriptionCell,
  InvestimentoSelectCell,
} from "./TransactionEditCells";

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

type TransacaoSortKey =
  "data" | "descricao" | "categoria" | "ativo" | "investimento" | "valor" | "percentual";

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
  investimentoId,
  tipo,
  totalParaPercentual,
  emptyMessage,
  showCategoria = true,
  showAtivo = true,
  showInvestimento = false,
  hiddenIds,
  onToggleHidden,
}: {
  filter: PeriodoFilter;
  categoriaId?: number;
  assetId?: number;
  liabilityId?: number;
  investimentoId?: number;
  tipo?: TransacaoTipo;
  totalParaPercentual?: string;
  emptyMessage: string;
  showCategoria?: boolean;
  showAtivo?: boolean;
  showInvestimento?: boolean;
  // "Ocultar gasto" (Sprint 27) — simulação client-side efêmera do funil
  // Despesa/Receita do Dashboard (ver GrupoAccordion). Só aparece a coluna
  // de binóculo quando onToggleHidden é passado; os demais consumidores de
  // TransactionsTable (Ativos/Passivos/Investimentos) não passam a prop e
  // ficam iguais a antes.
  hiddenIds?: Set<number>;
  onToggleHidden?: (transactionId: number, valor: number) => void;
}) {
  const query = usePluggyTransactions({
    ano: filter.ano,
    mes: filter.mes,
    subcategoryId: categoriaId,
    assetId,
    liabilityId,
    investimentoId,
    tipo,
    competencia: true,
  });
  const { data: subcategories } = useSubcategories();
  const { data: groups } = useCategoryGroups();
  const { data: assets } = useAssets();
  const { data: investimentos } = useInvestimentos();
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
        case "categoria": {
          const subcategoryId = item.subcategoria_sugerida_id ?? item.subcategory_id;
          return subcategoryId ? subcategoryLabel(subcategoryId, subcategories, groups) : "";
        }
        case "ativo":
          return assetLabel(item.asset_sugerido_id ?? item.asset_id, assets);
        case "investimento":
          return investimentoLabel(
            item.investimento_sugerido_id ?? item.investimento_id,
            investimentos
          );
      }
    },
    "data",
    "desc"
  );

  if (query.isLoading) return <p>Carregando...</p>;
  if (query.isError) return <p role="alert">Não foi possível carregar as transações.</p>;
  if (data.length === 0) return <p className="dash-empty">{emptyMessage}</p>;

  return (
    <div className="ac-table-wrap">
      <table className="ac-txn-table">
        <colgroup>
          <col className="col-data" />
          <col className="col-descricao" />
          {showCategoria && <col className="col-categoria" />}
          {showAtivo && <col className="col-ativo" />}
          {showInvestimento && <col className="col-investimento" />}
          <col className="col-valor" />
          {total !== undefined && <col className="col-percentual" />}
          {onToggleHidden && <col className="col-ocultar" />}
        </colgroup>
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
            {showCategoria && (
              <SortableHeader
                label="Categoria"
                sortKeyName="categoria"
                currentKey={sortKey}
                direction={direction}
                onClick={() => toggleSort("categoria")}
              />
            )}
            {showAtivo && (
              <SortableHeader
                label="Ativo"
                sortKeyName="ativo"
                currentKey={sortKey}
                direction={direction}
                onClick={() => toggleSort("ativo")}
              />
            )}
            {showInvestimento && (
              <SortableHeader
                label="Investimento"
                sortKeyName="investimento"
                currentKey={sortKey}
                direction={direction}
                onClick={() => toggleSort("investimento")}
              />
            )}
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
            {onToggleHidden && (
              <th>
                <span className="sr-only">Ocultar (simulação)</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((transaction) => {
            const percentual =
              total !== undefined && total > 0
                ? (Math.abs(Number(transaction.valor)) / total) * 100
                : 0;
            const oculta = hiddenIds?.has(transaction.id) ?? false;
            return (
              <tr key={transaction.id} className={oculta ? "hidden-row" : undefined}>
                <td className="date-cell">{transaction.data}</td>
                <td className="desc-cell">
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
                {showInvestimento && (
                  <td>
                    <InvestimentoSelectCell
                      transaction={transaction}
                      investimentos={investimentos}
                    />
                  </td>
                )}
                <td className="ac-col-valor">
                  <span className="ac-valor-cell">
                    <AccountTipoIcon tipo={transaction.account_tipo} />
                    <DirectionIcon despesa={transaction.tipo === "debito"} />
                    <span className="ac-valor-amt">{formatCurrency(transaction.valor)}</span>
                  </span>
                </td>
                {total !== undefined && <td className="pct-col">{formatPercent(percentual)}</td>}
                {onToggleHidden && (
                  <td>
                    <button
                      type="button"
                      className={`hide-toggle${oculta ? " active" : ""}`}
                      aria-pressed={oculta}
                      aria-label={
                        oculta
                          ? `Reexibir transação ${transaction.descricao}`
                          : `Ocultar transação ${transaction.descricao} (simulação)`
                      }
                      onClick={() => onToggleHidden(transaction.id, Number(transaction.valor))}
                    >
                      <BinocularIcon active={oculta} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
