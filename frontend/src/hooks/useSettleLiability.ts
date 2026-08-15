import { useMutation, useQueryClient } from "@tanstack/react-query";

import { settleLiability } from "../api/liabilities";

export function useSettleLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: settleLiability,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
    },
  });
}
