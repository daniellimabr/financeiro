import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateSalarioAjusteDezembro } from "../api/pluggy";
import { invalidateAfterTransactionEdit } from "./invalidateDashboardQueries";

export function useUpdateSalarioAjusteDezembro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalarioAjusteDezembro,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salarioAjusteDezembro"] });
      invalidateAfterTransactionEdit(queryClient);
    },
  });
}
