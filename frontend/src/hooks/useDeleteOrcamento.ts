import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteOrcamento } from "../api/orcamentos";
import { invalidateAfterOrcamentoEdit } from "./invalidateDashboardQueries";

export function useDeleteOrcamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOrcamento,
    onSuccess: () => invalidateAfterOrcamentoEdit(queryClient),
  });
}
