import { useMutation, useQueryClient } from "@tanstack/react-query";

import { resetDemoAccount } from "../api/demo";

export function useResetDemoAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resetDemoAccount,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
