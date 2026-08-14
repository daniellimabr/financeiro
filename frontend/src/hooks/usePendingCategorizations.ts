import { useQuery } from "@tanstack/react-query";

import { fetchPendingCategorizations } from "../api/categorization";

export function usePendingCategorizations() {
  return useQuery({
    queryKey: ["pendingCategorizations"],
    queryFn: fetchPendingCategorizations,
  });
}
