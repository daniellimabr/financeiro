import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorInvestimento,
  type PeriodoFilter,
  type Regime,
  type TransacaoTipo,
} from "../api/dashboards";

export function useInvestimentoGastos(
  tipo: TransacaoTipo,
  filter: PeriodoFilter & { regime?: Regime }
) {
  return useQuery({
    queryKey: ["dashboardPorInvestimento", tipo, filter.ano, filter.mes, filter.regime],
    queryFn: () => fetchDashboardPorInvestimento(tipo, filter),
  });
}
