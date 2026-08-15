import { useMutation, useQueryClient } from "@tanstack/react-query";

import { dismissDescriptionSuggestion } from "../api/categorization";

export function useDismissDescriptionSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: number) => dismissDescriptionSuggestion(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
