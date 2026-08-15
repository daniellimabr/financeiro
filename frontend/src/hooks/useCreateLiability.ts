import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createLiability } from "../api/liabilities";

export function useCreateLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLiability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
    },
  });
}
