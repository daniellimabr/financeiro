import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setCategory } from "../api/categorization";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useSetCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      subcategoryId,
    }: {
      transactionId: number;
      subcategoryId: number;
    }) => setCategory(transactionId, subcategoryId),
    onSuccess: () => {
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
