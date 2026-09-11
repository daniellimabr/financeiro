import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createItemPlanejado } from "../api/planejamento";

export function useCreateItemPlanejado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItemPlanejado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento"] });
    },
  });
}
