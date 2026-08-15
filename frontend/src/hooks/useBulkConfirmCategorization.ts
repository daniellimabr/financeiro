import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bulkConfirm, type BulkConfirmItem } from "../api/categorization";

export function useBulkConfirmCategorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: BulkConfirmItem[]) => bulkConfirm(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
