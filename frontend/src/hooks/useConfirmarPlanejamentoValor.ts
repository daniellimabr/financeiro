import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmarPlanejamentoValor } from "../api/planejamento";

export function useConfirmarPlanejamentoValor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subcategoryId,
      anoBase,
      mesBase,
      ano,
      mes,
      valor,
    }: {
      subcategoryId: number;
      anoBase: number;
      mesBase: number;
      ano: number;
      mes: number;
      valor: string;
    }) =>
      confirmarPlanejamentoValor(subcategoryId, {
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
