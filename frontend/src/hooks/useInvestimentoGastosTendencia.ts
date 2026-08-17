import { useQuery } from "@tanstack/react-query";

import {
  fetchDashboardPorInvestimentoTendencia,
  type PeriodoHistorico,
  type Regime,
  type TransacaoTipo,
} from "../api/dashboards";

export function useInvestimentoGastosTendencia(
  tipo: TransacaoTipo,
  ano: number,
  mes: number,
  meses: PeriodoHistorico,
  regime: Regime = "competencia"
) {
  return useQuery({
    queryKey: ["dashboardPorInvestimentoTendencia", tipo, ano, mes, meses, regime],
    queryFn: () => fetchDashboardPorInvestimentoTendencia(tipo, { ano, mes, meses, regime }),
  });
}
