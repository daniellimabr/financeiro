import { useQuery } from "@tanstack/react-query";

import { fetchCategoryGroups } from "../api/categories";

export function useCategoryGroups() {
  return useQuery({
    queryKey: ["categoryGroups"],
    queryFn: fetchCategoryGroups,
  });
}
