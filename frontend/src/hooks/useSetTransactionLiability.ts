import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setTransactionLiability } from "../api/categorization";

export function useSetTransactionLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      liabilityId,
    }: {
      transactionId: number;
      liabilityId: number | null;
    }) => setTransactionLiability(transactionId, liabilityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
