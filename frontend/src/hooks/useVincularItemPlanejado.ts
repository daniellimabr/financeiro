import { useMutation, useQueryClient } from "@tanstack/react-query";

import { vincularItemPlanejado } from "../api/planejamento";

export function useVincularItemPlanejado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, transacaoId }: { itemId: number; transacaoId: number }) =>
      vincularItemPlanejado(itemId, transacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento"] });
    },
  });
}
