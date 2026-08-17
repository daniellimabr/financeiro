import { useQuery } from "@tanstack/react-query";

import { fetchDashboardSummary, type PeriodoFilter, type Regime } from "../api/dashboards";

export function useDashboardSummary(filter: PeriodoFilter & { regime?: Regime }) {
  return useQuery({
    queryKey: ["dashboardSummary", filter.ano, filter.mes, filter.regime],
    queryFn: () => fetchDashboardSummary(filter),
  });
}
