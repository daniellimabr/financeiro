import { useQuery } from "@tanstack/react-query";

import { fetchDashboardTendencia, type PeriodoHistorico, type Regime } from "../api/dashboards";

export function useDashboardTendencia(
  ano: number,
  mes: number,
  meses: PeriodoHistorico,
  regime: Regime = "competencia"
) {
  return useQuery({
    queryKey: ["dashboardTendencia", ano, mes, meses, regime],
    queryFn: () => fetchDashboardTendencia({ ano, mes, meses, regime }),
  });
}
