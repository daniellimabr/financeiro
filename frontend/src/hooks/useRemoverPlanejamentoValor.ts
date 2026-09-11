import { useMutation, useQueryClient } from "@tanstack/react-query";

import { removerPlanejamentoValor } from "../api/planejamento";

export function useRemoverPlanejamentoValor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subcategoryId, ano, mes }: { subcategoryId: number; ano: number; mes: number }) =>
      removerPlanejamentoValor(subcategoryId, ano, mes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento", "grade"] });
    },
  });
}
