import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmCategorization } from "../api/categorization";

export function useConfirmCategorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      subcategoryId,
    }: {
      transactionId: number;
      subcategoryId: number;
    }) => confirmCategorization(transactionId, subcategoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingCategorizations"] });
    },
  });
}
