import { useQuery } from "@tanstack/react-query";

import { fetchInvestimentoTransacoes } from "../api/investimentos";

export function useInvestimentoTransacoes(
  investimentoId: number,
  { ano, mes }: { ano?: number; mes?: number } = {}
) {
  return useQuery({
    queryKey: ["investimentoTransacoes", investimentoId, ano, mes],
    queryFn: () => fetchInvestimentoTransacoes(investimentoId, { ano, mes }),
  });
}
