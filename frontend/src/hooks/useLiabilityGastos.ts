import { useQuery } from "@tanstack/react-query";

import { fetchDashboardPorPassivo, type PeriodoFilter } from "../api/dashboards";

export function useLiabilityGastos(filter: PeriodoFilter) {
  return useQuery({
    queryKey: ["dashboardPorPassivo", filter.ano, filter.mes],
    queryFn: () => fetchDashboardPorPassivo(filter),
  });
}
