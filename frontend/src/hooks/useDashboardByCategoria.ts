import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorCategoria,
  type PeriodoFilter,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardByCategoria(tipo: TransacaoTipo | undefined, filter: PeriodoFilter) {
  return useQuery({
    queryKey: ["dashboardPorCategoria", tipo, filter.ano, filter.mes],
    queryFn: () => fetchDashboardPorCategoria(tipo as TransacaoTipo, filter),
    enabled: tipo !== undefined,
  });
}
