import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorAtivoTendencia,
  type PeriodoHistorico,
  type TransacaoTipo,
} from "../api/dashboards";

export function useAssetGastosTendencia(
  tipo: TransacaoTipo,
  ano: number,
  mes: number,
  meses: PeriodoHistorico
) {
  return useQuery({
    queryKey: ["dashboardPorAtivoTendencia", tipo, ano, mes, meses],
    queryFn: () => fetchDashboardPorAtivoTendencia(tipo, { ano, mes, meses }),
  });
}
