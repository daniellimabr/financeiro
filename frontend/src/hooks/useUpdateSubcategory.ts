import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateSubcategory, type Subcategory } from "../api/categories";
import { invalidateAfterSubcategoryEdit } from "./invalidateDashboardQueries";

// PUT /subcategories/{id} substitui o registro inteiro — nome/group_id
// mudam aqui, mas a natureza atual precisa ser reenviada sem alteração
// (edição de natureza continua exclusiva de NaturezaPage/
// useUpdateSubcategoryNatureza).
export function useUpdateSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      subcategory,
      nome,
      groupId,
    }: {
      subcategory: Subcategory;
      nome: string;
      groupId: number;
    }) => updateSubcategory(subcategory.id, { groupId, nome, natureza: subcategory.natureza }),
    onSuccess: () => {
      invalidateAfterSubcategoryEdit(queryClient);
    },
  });
}
