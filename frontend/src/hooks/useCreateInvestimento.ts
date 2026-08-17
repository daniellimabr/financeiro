import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createInvestimento } from "../api/investimentos";

export function useCreateInvestimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvestimento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investimentos"] });
    },
  });
}
