import { useQuery } from "@tanstack/react-query";

import { fetchEvolucaoMensalConsolidada } from "../api/investimentos";

export function useEvolucaoMensalConsolidada() {
  return useQuery({
    queryKey: ["evolucaoMensalConsolidada"],
    queryFn: fetchEvolucaoMensalConsolidada,
  });
}
