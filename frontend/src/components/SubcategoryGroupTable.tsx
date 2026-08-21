import type { ReactNode } from "react";

import type { CategoryGroup, Subcategory } from "../api/categories";
import type { SortDirection } from "../hooks/useTableSort";
import { SortableHeader } from "./SortableHeader";

export type SubcategoryGroupSortKey = "grupo" | "subcategoria";

export interface GrupoComSubcategorias {
  group: CategoryGroup;
  subcategorias: Subcategory[];
}

interface SubcategoryGroupTableProps {
  grupos: GrupoComSubcategorias[];
  sortKey: SubcategoryGroupSortKey;
  sortDirection: SortDirection;
  onSort: (key: SubcategoryGroupSortKey) => void;
  terceiraColunaLabel: string;
  renderGroupCell?: (group: CategoryGroup) => ReactNode;
  renderThirdColumn: (subcategory: Subcategory, group: CategoryGroup) => ReactNode;
  renderEmptyGroupRow?: (group: CategoryGroup) => ReactNode;
}

// Tabela agrupada por CategoryGroup (rowSpan na 1a coluna) — extraída da
// tabela de classificação de Natureza (Sprint 12) pra reuso em CategoriasPage
// (Sprint 30). Cada consumidor controla o conteúdo da 3a coluna (select de
// natureza, ou ações de CRUD) via render prop; o agrupamento/ordenação em si
// é sempre o mesmo. Migrada pro Analyst Console na Sprint 35 (épico E10) —
// sem prop de variante, os dois consumidores migram juntos.
export function SubcategoryGroupTable({
  grupos,
  sortKey,
  sortDirection,
  onSort,
  terceiraColunaLabel,
  renderGroupCell,
  renderThirdColumn,
  renderEmptyGroupRow,
}: SubcategoryGroupTableProps) {
  return (
    <div className="ac-table-wrap">
      <table className="subcategory-group-table">
        <colgroup>
          <col className="col-grupo" />
          <col className="col-subcategoria" />
          <col className="col-terceira" />
        </colgroup>
        <thead>
          <tr>
            <SortableHeader
              label="Categoria"
              sortKeyName="grupo"
              currentKey={sortKey}
              direction={sortDirection}
              onClick={() => onSort("grupo")}
            />
            <SortableHeader
              label="Subcategoria"
              sortKeyName="subcategoria"
              currentKey={sortKey}
              direction={sortDirection}
              onClick={() => onSort("subcategoria")}
            />
            <th>{terceiraColunaLabel}</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ group, subcategorias }) =>
            subcategorias.length === 0 ? (
              <tr key={group.id} className="group-start">
                <td>{renderGroupCell ? renderGroupCell(group) : group.nome}</td>
                <td colSpan={2}>
                  {renderEmptyGroupRow ? renderEmptyGroupRow(group) : "Nenhuma subcategoria"}
                </td>
              </tr>
            ) : (
              subcategorias.map((sub, index) => (
                <tr key={sub.id} className={index === 0 ? "group-start" : undefined}>
                  {index === 0 && (
                    <td rowSpan={subcategorias.length}>
                      {renderGroupCell ? renderGroupCell(group) : group.nome}
                    </td>
                  )}
                  <td>{sub.nome}</td>
                  <td>{renderThirdColumn(sub, group)}</td>
                </tr>
              ))
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
