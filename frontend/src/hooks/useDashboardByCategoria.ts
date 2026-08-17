import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorCategoria,
  type PeriodoFilter,
  type Regime,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardByCategoria(
  tipo: TransacaoTipo | undefined,
  filter: PeriodoFilter & { regime?: Regime }
) {
  return useQuery({
    queryKey: ["dashboardPorCategoria", tipo, filter.ano, filter.mes, filter.regime],
    queryFn: () => fetchDashboardPorCategoria(tipo as TransacaoTipo, filter),
    enabled: tipo !== undefined,
  });
}
