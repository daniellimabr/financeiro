import { useQuery } from "@tanstack/react-query";

import { fetchOrcamentos } from "../api/orcamentos";

export function useOrcamentos() {
  return useQuery({
    queryKey: ["orcamentos"],
    queryFn: fetchOrcamentos,
  });
}
