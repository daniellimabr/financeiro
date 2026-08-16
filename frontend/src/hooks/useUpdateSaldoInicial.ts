import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePluggyAccountSaldoInicial } from "../api/pluggy";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useUpdateSaldoInicial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, saldoInicial }: { accountId: number; saldoInicial: string | null }) =>
      updatePluggyAccountSaldoInicial(accountId, saldoInicial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["evolucaoSaldoPorConta"] });
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
