import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteAsset } from "../api/assets";

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardPorAtivo"] });
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
