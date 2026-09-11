import { useMutation, useQueryClient } from "@tanstack/react-query";

import { desvincularItemPlanejado } from "../api/planejamento";

export function useDesvincularItemPlanejado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: desvincularItemPlanejado,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planejamento"] });
    },
  });
}
