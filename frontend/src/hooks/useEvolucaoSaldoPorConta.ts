import { useQuery } from "@tanstack/react-query";

import { fetchEvolucaoSaldoPorConta, type PeriodoHistorico } from "../api/dashboards";

export function useEvolucaoSaldoPorConta(ano: number, mes: number, meses: PeriodoHistorico = 6) {
  return useQuery({
    queryKey: ["evolucaoSaldoPorConta", ano, mes, meses],
    queryFn: () => fetchEvolucaoSaldoPorConta({ ano, mes, meses }),
  });
}
