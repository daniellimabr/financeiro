import { useQuery } from "@tanstack/react-query";

import { fetchLiabilities } from "../api/liabilities";

export function useLiabilities() {
  return useQuery({
    queryKey: ["liabilities"],
    queryFn: fetchLiabilities,
  });
}
