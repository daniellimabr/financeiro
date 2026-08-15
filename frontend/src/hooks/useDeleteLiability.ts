import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteLiability } from "../api/liabilities";

export function useDeleteLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLiability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardPorPassivo"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardPorPassivoTendencia"] });
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
