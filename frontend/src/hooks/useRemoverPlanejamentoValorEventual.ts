import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TransacaoTipo } from "../api/dashboards";
import { removerPlanejamentoValorEventual } from "../api/planejamento";

export function useRemoverPlanejamentoValorEventual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tipo, ano, mes }: { tipo: TransacaoTipo; ano: number; mes: number }) =>
      removerPlanejamentoValorEventual(tipo, ano, mes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento", "grade"] });
    },
  });
}
