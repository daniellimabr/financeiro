import { useQuery } from "@tanstack/react-query";

import { fetchDashboardTendencia, type PeriodoHistorico } from "../api/dashboards";

export function useDashboardTendencia(ano: number, mes: number, meses: PeriodoHistorico) {
  return useQuery({
    queryKey: ["dashboardTendencia", ano, mes, meses],
    queryFn: () => fetchDashboardTendencia({ ano, mes, meses }),
  });
}
