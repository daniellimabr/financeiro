import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateItemPlanejado, type ItemPlanejadoInput } from "../api/planejamento";

export function useUpdateItemPlanejado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: number; input: ItemPlanejadoInput }) =>
      updateItemPlanejado(itemId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento"] });
    },
  });
}
