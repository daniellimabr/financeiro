import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateInvestimento, type InvestimentoInput } from "../api/investimentos";

export function useUpdateInvestimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ investimentoId, input }: { investimentoId: number; input: InvestimentoInput }) =>
      updateInvestimento(investimentoId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investimentos"] });
    },
  });
}
