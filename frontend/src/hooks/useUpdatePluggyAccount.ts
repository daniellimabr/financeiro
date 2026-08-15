import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePluggyAccount } from "../api/pluggy";

export function useUpdatePluggyAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      apelido,
      syncEnabled,
    }: {
      accountId: number;
      apelido: string | null;
      syncEnabled: boolean;
    }) => updatePluggyAccount(accountId, { apelido, syncEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyAccounts"] });
    },
  });
}
