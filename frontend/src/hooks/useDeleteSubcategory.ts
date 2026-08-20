import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteSubcategory } from "../api/categories";
import { invalidateAfterSubcategoryEdit } from "./invalidateDashboardQueries";

export function useDeleteSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSubcategory,
    onSuccess: () => invalidateAfterSubcategoryEdit(queryClient),
  });
}
