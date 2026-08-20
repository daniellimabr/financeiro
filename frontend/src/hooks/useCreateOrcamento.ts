import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createOrcamento } from "../api/orcamentos";
import { invalidateAfterOrcamentoEdit } from "./invalidateDashboardQueries";

export function useCreateOrcamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOrcamento,
    onSuccess: () => invalidateAfterOrcamentoEdit(queryClient),
  });
}
