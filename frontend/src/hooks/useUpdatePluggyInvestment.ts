import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePluggyInvestment } from "../api/pluggy";

export function useUpdatePluggyInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      investmentId,
      investimentoId,
    }: {
      investmentId: number;
      investimentoId: number | null;
    }) => updatePluggyInvestment(investmentId, investimentoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyInvestments"] });
      // Vincular/desvincular a posição muda saldo_base/saldo_atual usados em
      // GET /investimentos/{id}/evolucao (mesmo princípio de useUpdatePluggyAccount).
      queryClient.invalidateQueries({ queryKey: ["investimentoEvolucao"] });
    },
  });
}
