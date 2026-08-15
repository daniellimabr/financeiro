import { useQuery } from "@tanstack/react-query";

import { fetchPluggyTransactions, type PluggyTransactionFilters } from "../api/pluggy";

export function usePluggyTransactions(
  filters: PluggyTransactionFilters = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: [
      "pluggyTransactions",
      filters.ano,
      filters.mes,
      filters.subcategoryId,
      filters.accountTipo,
      filters.assetId,
      filters.liabilityId,
      filters.tipo,
      filters.competencia,
    ],
    queryFn: () => fetchPluggyTransactions(filters),
    enabled: options.enabled ?? true,
  });
}
