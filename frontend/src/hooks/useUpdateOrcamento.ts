import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateOrcamento, type OrcamentoInput } from "../api/orcamentos";
import { invalidateAfterOrcamentoEdit } from "./invalidateDashboardQueries";

export function useUpdateOrcamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orcamentoId, input }: { orcamentoId: number; input: OrcamentoInput }) =>
      updateOrcamento(orcamentoId, input),
    onSuccess: () => invalidateAfterOrcamentoEdit(queryClient),
  });
}
