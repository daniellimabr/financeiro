import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setTransactionInvestimento } from "../api/categorization";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useSetTransactionInvestimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      investimentoId,
    }: {
      transactionId: number;
      investimentoId: number | null;
    }) => setTransactionInvestimento(transactionId, investimentoId),
    onSuccess: () => {
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
