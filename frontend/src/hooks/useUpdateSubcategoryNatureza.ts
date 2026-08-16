import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateSubcategory, type Subcategory } from "../api/categories";
import { invalidateAfterSubcategoryEdit } from "./invalidateDashboardQueries";

export function useUpdateSubcategoryNatureza() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subcategory, natureza }: { subcategory: Subcategory; natureza: string }) =>
      updateSubcategory(subcategory.id, {
        groupId: subcategory.group_id,
        nome: subcategory.nome,
        natureza,
      }),
    onSuccess: () => {
      invalidateAfterSubcategoryEdit(queryClient);
    },
  });
}
