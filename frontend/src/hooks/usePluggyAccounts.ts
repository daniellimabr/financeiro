import { useQuery } from "@tanstack/react-query";

import { fetchPluggyAccounts } from "../api/pluggy";

export function usePluggyAccounts() {
  return useQuery({
    queryKey: ["pluggyAccounts"],
    queryFn: fetchPluggyAccounts,
  });
}
