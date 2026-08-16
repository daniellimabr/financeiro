import { useQuery } from "@tanstack/react-query";

import { fetchSalarioAjusteDezembro } from "../api/pluggy";

export function useSalarioAjusteDezembro() {
  return useQuery({
    queryKey: ["salarioAjusteDezembro"],
    queryFn: fetchSalarioAjusteDezembro,
  });
}
