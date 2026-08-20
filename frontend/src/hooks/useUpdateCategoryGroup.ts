import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateCategoryGroup } from "../api/categories";
import { invalidateAfterSubcategoryEdit } from "./invalidateDashboardQueries";

export function useUpdateCategoryGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, nome }: { groupId: number; nome: string }) =>
      updateCategoryGroup(groupId, nome),
    onSuccess: () => invalidateAfterSubcategoryEdit(queryClient),
  });
}
