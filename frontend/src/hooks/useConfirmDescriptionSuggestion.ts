import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmDescriptionSuggestion } from "../api/categorization";

export function useConfirmDescriptionSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: number) => confirmDescriptionSuggestion(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
