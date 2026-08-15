import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorCategoriaTendencia,
  type PeriodoHistorico,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardCategoriaTendencia(
  tipo: TransacaoTipo | undefined,
  ano: number,
  mes: number,
  meses: PeriodoHistorico
) {
  return useQuery({
    queryKey: ["dashboardPorCategoriaTendencia", tipo, ano, mes, meses],
    queryFn: () => fetchDashboardPorCategoriaTendencia(tipo as TransacaoTipo, { ano, mes, meses }),
    enabled: tipo !== undefined,
  });
}
