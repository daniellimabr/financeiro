import { useQuery } from "@tanstack/react-query";

import { fetchPluggyInvestments } from "../api/pluggy";

export function usePluggyInvestments(investimentoId?: number) {
  return useQuery({
    queryKey: ["pluggyInvestments", investimentoId ?? null],
    queryFn: () => fetchPluggyInvestments(investimentoId),
  });
}
