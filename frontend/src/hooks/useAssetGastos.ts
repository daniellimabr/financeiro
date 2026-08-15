import { useQuery } from "@tanstack/react-query";

import { fetchDashboardPorAtivo, type PeriodoFilter } from "../api/dashboards";

export function useAssetGastos(filter: PeriodoFilter) {
  return useQuery({
    queryKey: ["dashboardPorAtivo", filter.ano, filter.mes],
    queryFn: () => fetchDashboardPorAtivo(filter),
  });
}
