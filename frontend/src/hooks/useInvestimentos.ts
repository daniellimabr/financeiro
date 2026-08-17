import { useQuery } from "@tanstack/react-query";

import { fetchInvestimentos } from "../api/investimentos";

export function useInvestimentos() {
  return useQuery({
    queryKey: ["investimentos"],
    queryFn: fetchInvestimentos,
  });
}
