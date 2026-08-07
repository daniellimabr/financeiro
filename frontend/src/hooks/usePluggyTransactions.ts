import { useQuery } from "@tanstack/react-query";

import { fetchPluggyTransactions } from "../api/pluggy";

export function usePluggyTransactions() {
  return useQuery({
    queryKey: ["pluggyTransactions"],
    queryFn: fetchPluggyTransactions,
  });
}
