import { useQuery } from "@tanstack/react-query";

import { fetchDashboardSummary, type PeriodoFilter } from "../api/dashboards";

export function useDashboardSummary(filter: PeriodoFilter) {
  return useQuery({
    queryKey: ["dashboardSummary", filter.ano, filter.mes],
    queryFn: () => fetchDashboardSummary(filter),
  });
}
