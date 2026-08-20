import { useQuery } from "@tanstack/react-query";

import { fetchSaldoAcumuladoConferencia } from "../api/dashboards";

// Tabela de conferência do drill-down do Saldo Acumulado (PRD-032) — Total +
// uma linha por conta corrente, sempre do mês filtrado (sem histórico).
export function useSaldoAcumuladoConferencia(ano: number, mes: number) {
  return useQuery({
    queryKey: ["saldoAcumuladoConferencia", ano, mes],
    queryFn: () => fetchSaldoAcumuladoConferencia({ ano, mes }),
  });
}
