import { useQuery } from "@tanstack/react-query";

import { fetchEvolucaoMensal } from "../api/investimentos";

export function useEvolucaoMensal(investimentoId: number) {
  return useQuery({
    queryKey: ["evolucaoMensal", investimentoId],
    queryFn: () => fetchEvolucaoMensal(investimentoId),
  });
}
