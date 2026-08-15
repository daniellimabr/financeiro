import { useQuery } from "@tanstack/react-query";

import { fetchPatrimonioBreakdown } from "../api/dashboards";

export function usePatrimonioBreakdown() {
  return useQuery({
    queryKey: ["dashboardPatrimonioBreakdown"],
    queryFn: fetchPatrimonioBreakdown,
  });
}
