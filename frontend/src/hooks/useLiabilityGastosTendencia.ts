import { useQuery } from "@tanstack/react-query";

import { fetchDashboardPorPassivoTendencia, type PeriodoHistorico } from "../api/dashboards";

export function useLiabilityGastosTendencia(ano: number, mes: number, meses: PeriodoHistorico) {
  return useQuery({
    queryKey: ["dashboardPorPassivoTendencia", ano, mes, meses],
    queryFn: () => fetchDashboardPorPassivoTendencia({ ano, mes, meses }),
  });
}
