import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteInvestimento } from "../api/investimentos";

export function useDeleteInvestimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteInvestimento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investimentos"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyAccounts"] });
      queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardPorInvestimento"] });
      queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
    },
  });
}
