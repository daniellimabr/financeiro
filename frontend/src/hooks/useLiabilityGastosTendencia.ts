import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorPassivoTendencia,
  type PeriodoHistorico,
  type Regime,
} from "../api/dashboards";

export function useLiabilityGastosTendencia(
  ano: number,
  mes: number,
  meses: PeriodoHistorico,
  regime: Regime = "competencia"
) {
  return useQuery({
    queryKey: ["dashboardPorPassivoTendencia", ano, mes, meses, regime],
    queryFn: () => fetchDashboardPorPassivoTendencia({ ano, mes, meses, regime }),
  });
}
