import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePluggyAccount } from "../api/pluggy";

export function useUpdatePluggyAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      apelido,
      syncEnabled,
      investimentoId,
    }: {
      accountId: number;
      apelido: string | null;
      syncEnabled: boolean;
      investimentoId?: number | null;
    }) => updatePluggyAccount(accountId, { apelido, syncEnabled, investimentoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyAccounts"] });
      // Vincular/desvincular a carteira a um Investimento muda saldo_base
      // (saldo_inicial) e saldo_atual usados em GET /investimentos/{id}/evolucao.
      queryClient.invalidateQueries({ queryKey: ["investimentoEvolucao"] });
    },
  });
}
