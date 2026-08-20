import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createCategoryGroup } from "../api/categories";
import { invalidateAfterSubcategoryEdit } from "./invalidateDashboardQueries";

export function useCreateCategoryGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategoryGroup,
    onSuccess: () => invalidateAfterSubcategoryEdit(queryClient),
  });
}
