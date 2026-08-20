import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createSubcategory } from "../api/categories";
import { invalidateAfterSubcategoryEdit } from "./invalidateDashboardQueries";

export function useCreateSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubcategory,
    onSuccess: () => invalidateAfterSubcategoryEdit(queryClient),
  });
}
