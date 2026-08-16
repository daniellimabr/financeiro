import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateUserSettings } from "../api/auth";

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cutoffDia: number) => updateUserSettings(cutoffDia),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
}
