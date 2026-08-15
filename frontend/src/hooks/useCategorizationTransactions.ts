import { useQuery } from "@tanstack/react-query";

import { fetchTransactions, type TransactionsFilter } from "../api/categorization";

export function useCategorizationTransactions(filter: TransactionsFilter = {}) {
  return useQuery({
    queryKey: [
      "categorizationTransactions",
      filter.status,
      filter.tipo,
      filter.ano,
      filter.mes,
      filter.page,
      filter.pageSize,
    ],
    queryFn: () => fetchTransactions(filter),
  });
}
