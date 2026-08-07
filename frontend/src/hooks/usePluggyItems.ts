import { useQuery } from "@tanstack/react-query";

import { fetchPluggyItems } from "../api/pluggy";

export function usePluggyItems() {
  return useQuery({
    queryKey: ["pluggyItems"],
    queryFn: fetchPluggyItems,
  });
}
