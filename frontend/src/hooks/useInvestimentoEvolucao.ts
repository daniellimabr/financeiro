import { useQuery } from "@tanstack/react-query";

import { fetchInvestimentoEvolucao } from "../api/investimentos";

export function useInvestimentoEvolucao(investimentoId: number) {
  return useQuery({
    queryKey: ["investimentoEvolucao", investimentoId],
    queryFn: () => fetchInvestimentoEvolucao(investimentoId),
  });
}
