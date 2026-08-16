import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorNaturezaTendencia,
  type PeriodoHistorico,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardNaturezaTendencia(
  tipo: TransacaoTipo | undefined,
  ano: number,
  mes: number,
  meses: PeriodoHistorico
) {
  return useQuery({
    queryKey: ["dashboardPorNaturezaTendencia", tipo, ano, mes, meses],
    queryFn: () => fetchDashboardPorNaturezaTendencia(tipo as TransacaoTipo, { ano, mes, meses }),
    enabled: tipo !== undefined,
  });
}
