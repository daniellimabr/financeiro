import { useQuery } from "@tanstack/react-query";

import { fetchDashboardPorPassivo, type PeriodoFilter, type Regime } from "../api/dashboards";

export function useLiabilityGastos(filter: PeriodoFilter & { regime?: Regime }) {
  return useQuery({
    queryKey: ["dashboardPorPassivo", filter.ano, filter.mes, filter.regime],
    queryFn: () => fetchDashboardPorPassivo(filter),
  });
}
