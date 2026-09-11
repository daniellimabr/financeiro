import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteItemPlanejado } from "../api/planejamento";

export function useDeleteItemPlanejado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteItemPlanejado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento"] });
    },
  });
}
