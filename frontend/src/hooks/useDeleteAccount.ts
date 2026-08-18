import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteAccount } from "../api/pluggy";

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["evolucaoSaldoPorConta"] });
    },
  });
}
