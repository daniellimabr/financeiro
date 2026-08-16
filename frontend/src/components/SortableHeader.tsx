import type { SortDirection } from "../hooks/useTableSort";

// Cabeçalho de coluna ordenável, genérico sobre a união de chaves de sort de
// cada tabela (useTableSort já é genérico do mesmo jeito). Extraído de
// TransactionsTable.tsx (Sprint 13) pra reuso em CategorizationReviewPage e
// na tabela de classificação de NaturezaPage.
export function SortableHeader<K extends string>({
  label,
  sortKeyName,
  currentKey,
  direction,
  onClick,
}: {
  label: string;
  sortKeyName: K;
  currentKey: K;
  direction: SortDirection;
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
