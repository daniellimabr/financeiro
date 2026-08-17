import { useQuery } from "@tanstack/react-query";

import { fetchSaldoAcumulado, type PeriodoHistorico, type Regime } from "../api/dashboards";

// Pede um mês a mais que o histórico selecionado — o ponto extra à frente da
// janela é o valor do "mês anterior" ao filtro, usado pelo card "Saldo
// Anterior" sem precisar de uma segunda chamada.
export function useDashboardSaldoAcumulado(
  ano: number,
  mes: number,
  periodoHistorico: PeriodoHistorico,
  regime: Regime = "competencia"
) {
  return useQuery({
    queryKey: ["dashboardSaldoAcumulado", ano, mes, periodoHistorico, regime],
    queryFn: () => fetchSaldoAcumulado({ ano, mes, meses: periodoHistorico + 1, regime }),
  });
}
