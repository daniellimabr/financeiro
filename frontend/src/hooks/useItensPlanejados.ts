import { useQuery } from "@tanstack/react-query";

import { fetchItensPlanejados } from "../api/planejamento";

export function useItensPlanejados() {
  return useQuery({
    queryKey: ["planejamento", "itens"],
    queryFn: fetchItensPlanejados,
  });
}
