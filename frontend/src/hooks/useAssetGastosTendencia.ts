import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorAtivoTendencia,
  type PeriodoHistorico,
  type Regime,
  type TransacaoTipo,
} from "../api/dashboards";

export function useAssetGastosTendencia(
  tipo: TransacaoTipo,
  ano: number,
  mes: number,
  meses: PeriodoHistorico,
  regime: Regime = "competencia"
) {
  return useQuery({
    queryKey: ["dashboardPorAtivoTendencia", tipo, ano, mes, meses, regime],
    queryFn: () => fetchDashboardPorAtivoTendencia(tipo, { ano, mes, meses, regime }),
  });
}
