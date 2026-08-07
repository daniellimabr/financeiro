import { useMutation, useQueryClient } from "@tanstack/react-query";

import { registerPluggyItem } from "../api/pluggy";

export function useRegisterPluggyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerPluggyItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggyItems"] });
    },
  });
}
