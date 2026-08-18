import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePluggyInvestmentSaldoInicial } from "../api/pluggy";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useUpdatePluggyInvestmentSaldoInicial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      investmentId,
      saldoInicial,
    }: {
      investmentId: number;
      saldoInicial: string | null;
    }) => updatePluggyInvestmentSaldoInicial(investmentId, saldoInicial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyInvestments"] });
      queryClient.invalidateQueries({ queryKey: ["investimentoEvolucao"] });
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
