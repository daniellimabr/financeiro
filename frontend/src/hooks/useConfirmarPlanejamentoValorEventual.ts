import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TransacaoTipo } from "../api/dashboards";
import { confirmarPlanejamentoValorEventual } from "../api/planejamento";

export function useConfirmarPlanejamentoValorEventual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tipo,
      anoBase,
      mesBase,
      ano,
      mes,
      valor,
    }: {
      tipo: TransacaoTipo;
      anoBase: number;
      mesBase: number;
      ano: number;
      mes: number;
      valor: string;
    }) =>
      confirmarPlanejamentoValorEventual(tipo, {
        ano_base: anoBase,
        mes_base: mesBase,
        ano,
        mes,
        valor,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento", "grade"] });
    },
  });
}
