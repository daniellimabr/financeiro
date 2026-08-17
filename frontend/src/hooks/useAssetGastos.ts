import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorAtivo,
  type PeriodoFilter,
  type Regime,
  type TransacaoTipo,
} from "../api/dashboards";

export function useAssetGastos(tipo: TransacaoTipo, filter: PeriodoFilter & { regime?: Regime }) {
  return useQuery({
    queryKey: ["dashboardPorAtivo", tipo, filter.ano, filter.mes, filter.regime],
    queryFn: () => fetchDashboardPorAtivo(tipo, filter),
  });
}
