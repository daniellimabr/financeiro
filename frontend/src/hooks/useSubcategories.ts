import { useQuery } from "@tanstack/react-query";

import { fetchSubcategories } from "../api/categories";

export function useSubcategories() {
  return useQuery({
    queryKey: ["subcategories"],
    queryFn: fetchSubcategories,
  });
}
