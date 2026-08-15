import { useQuery } from "@tanstack/react-query";

import { fetchSaldoPorConta } from "../api/dashboards";

export function useSaldoPorConta() {
  return useQuery({
    queryKey: ["saldoPorConta"],
    queryFn: fetchSaldoPorConta,
  });
}
