import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorMeioPagamento,
  type PeriodoFilter,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardByMeioPagamento(
  tipo: TransacaoTipo | undefined,
  filter: PeriodoFilter & { categoriaId?: number }
) {
  return useQuery({
    queryKey: ["dashboardPorMeioPagamento", tipo, filter.ano, filter.mes, filter.categoriaId],
    queryFn: () => fetchDashboardPorMeioPagamento(tipo as TransacaoTipo, filter),
    enabled: tipo !== undefined,
  });
}
