import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TransacaoTipo } from "../api/dashboards";
import { confirmarPlanejamentoValorEventual } from "../api/planejamento";

export function useConfirmarPlanejamentoValorEventual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tipo,
      ano,
      mes,
      valor,
    }: {
      tipo: TransacaoTipo;
      ano: number;
      mes: number;
      valor: string;
    }) => confirmarPlanejamentoValorEventual(tipo, { ano, mes, valor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento", "grade"] });
    },
  });
}
