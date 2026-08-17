import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateData } from "../api/categorization";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useUpdateDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, data }: { transactionId: number; data: string }) =>
      updateData(transactionId, data),
    onSuccess: () => {
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
