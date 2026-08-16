import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorNatureza,
  type PeriodoFilter,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardByNatureza(tipo: TransacaoTipo | undefined, filter: PeriodoFilter) {
  return useQuery({
    queryKey: ["dashboardPorNatureza", tipo, filter.ano, filter.mes],
    queryFn: () => fetchDashboardPorNatureza(tipo as TransacaoTipo, filter),
    enabled: tipo !== undefined,
  });
}
