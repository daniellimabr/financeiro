import { useMutation, useQueryClient } from "@tanstack/react-query";

import { syncPluggyItem } from "../api/pluggy";

export function useSyncPluggyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncPluggyItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyItems"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
    },
  });
}
