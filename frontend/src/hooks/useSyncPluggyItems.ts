import { useMutation, useQueryClient } from "@tanstack/react-query";

import { syncPluggyItems } from "../api/pluggy";

export function useSyncPluggyItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds?: number[]) => syncPluggyItems(itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyItems"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
