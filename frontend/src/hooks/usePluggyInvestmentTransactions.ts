import { useQuery } from "@tanstack/react-query";

import { fetchPluggyInvestmentTransactions } from "../api/pluggy";

export function usePluggyInvestmentTransactions(investmentId: number, enabled = true) {
  return useQuery({
    queryKey: ["pluggyInvestmentTransactions", investmentId],
    queryFn: () => fetchPluggyInvestmentTransactions(investmentId),
    enabled,
  });
}
