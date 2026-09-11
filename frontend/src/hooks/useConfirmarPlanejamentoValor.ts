import { useMutation, useQueryClient } from "@tanstack/react-query";

import { confirmarPlanejamentoValor } from "../api/planejamento";

export function useConfirmarPlanejamentoValor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subcategoryId,
      ano,
      mes,
      valor,
    }: {
      subcategoryId: number;
      ano: number;
      mes: number;
      valor: string;
    }) => confirmarPlanejamentoValor(subcategoryId, { ano, mes, valor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento", "grade"] });
    },
  });
}
