import { useQuery } from "@tanstack/react-query";

import { fetchDashboardProjecao, type PeriodoHistorico } from "../api/dashboards";

export function useDashboardProjecao(ano: number, mes: number, mesesFuturos: PeriodoHistorico) {
  return useQuery({
    queryKey: ["dashboardProjecao", ano, mes, mesesFuturos],
    queryFn: () => fetchDashboardProjecao({ ano, mes, mesesFuturos }),
  });
}
