import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorCategoriaTendencia,
  type PeriodoHistorico,
  type Regime,
  type TransacaoTipo,
} from "../api/dashboards";

export function useDashboardCategoriaTendencia(
  tipo: TransacaoTipo | undefined,
  ano: number,
  mes: number,
  meses: PeriodoHistorico,
  regime: Regime = "competencia"
) {
  return useQuery({
    queryKey: ["dashboardPorCategoriaTendencia", tipo, ano, mes, meses, regime],
    queryFn: () =>
      fetchDashboardPorCategoriaTendencia(tipo as TransacaoTipo, { ano, mes, meses, regime }),
    enabled: tipo !== undefined,
  });
}
