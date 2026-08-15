import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateDescription } from "../api/categorization";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useUpdateDescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, descricao }: { transactionId: number; descricao: string }) =>
      updateDescription(transactionId, descricao),
    onSuccess: () => {
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
