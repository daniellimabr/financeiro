import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setTransactionAsset } from "../api/categorization";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useSetTransactionAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, assetId }: { transactionId: number; assetId: number | null }) =>
      setTransactionAsset(transactionId, assetId),
    onSuccess: () => {
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
