import { useQuery } from "@tanstack/react-query";

import { fetchSaldoAcumulado, type PeriodoHistorico } from "../api/dashboards";

// Pede um mês a mais que o histórico selecionado — o ponto extra à frente da
// janela é o valor do "mês anterior" ao filtro, usado pelo card "Saldo
// Anterior" sem precisar de uma segunda chamada. Não depende de regime
// (PRD-032) — a fórmula nova sempre usa saldo real por conta corrente.
export function useDashboardSaldoAcumulado(
  ano: number,
  mes: number,
  periodoHistorico: PeriodoHistorico
) {
  return useQuery({
    queryKey: ["dashboardSaldoAcumulado", ano, mes, periodoHistorico],
    queryFn: () => fetchSaldoAcumulado({ ano, mes, meses: periodoHistorico + 1 }),
  });
}
