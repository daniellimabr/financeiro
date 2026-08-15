import { useQuery } from "@tanstack/react-query";

import { fetchDashboardPorAtivo, type PeriodoFilter, type TransacaoTipo } from "../api/dashboards";

export function useAssetGastos(tipo: TransacaoTipo, filter: PeriodoFilter) {
  return useQuery({
    queryKey: ["dashboardPorAtivo", tipo, filter.ano, filter.mes],
    queryFn: () => fetchDashboardPorAtivo(tipo, filter),
  });
}
