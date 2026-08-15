import { useQuery } from "@tanstack/react-query";

import {
  fetchPendingCategorizations,
  type PendingCategorizationsFilter,
} from "../api/categorization";

export function usePendingCategorizations(filter: PendingCategorizationsFilter = {}) {
  return useQuery({
    queryKey: ["pendingCategorizations", filter.ano, filter.mes, filter.page, filter.pageSize],
    queryFn: () => fetchPendingCategorizations(filter),
  });
}
