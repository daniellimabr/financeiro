import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmBaselineProposal } from "../api/pluggy";

export function useConfirmBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linhas: { investmentId: number; saldoInicial: string }[]) =>
      confirmBaselineProposal(linhas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyInvestments"] });
      queryClient.invalidateQueries({ queryKey: ["baselineProposalDez2025"] });
      queryClient.invalidateQueries({ queryKey: ["investimentoEvolucao"] });
      queryClient.invalidateQueries({ queryKey: ["evolucaoMensal"] });
    },
  });
}
