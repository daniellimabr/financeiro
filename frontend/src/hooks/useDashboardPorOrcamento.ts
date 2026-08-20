import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorOrcamento,
  type PeriodoFilter,
  type Regime,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardPorOrcamento(
  tipo: TransacaoTipo,
  filter: Required<PeriodoFilter> & { regime?: Regime }
) {
  return useQuery({
    queryKey: ["dashboardPorOrcamento", tipo, filter.ano, filter.mes, filter.regime],
    queryFn: () => fetchDashboardPorOrcamento(tipo, filter),
  });
}
