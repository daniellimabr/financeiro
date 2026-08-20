import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteCategoryGroup } from "../api/categories";
import { invalidateAfterSubcategoryEdit } from "./invalidateDashboardQueries";

export function useDeleteCategoryGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCategoryGroup,
    onSuccess: () => invalidateAfterSubcategoryEdit(queryClient),
  });
}
