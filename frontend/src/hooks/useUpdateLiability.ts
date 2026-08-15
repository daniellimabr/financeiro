import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateLiability, type LiabilityInput } from "../api/liabilities";

export function useUpdateLiability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ liabilityId, input }: { liabilityId: number; input: LiabilityInput }) =>
      updateLiability(liabilityId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
    },
  });
}
