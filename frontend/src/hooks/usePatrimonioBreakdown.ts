import { useQuery } from "@tanstack/react-query";

import { fetchPatrimonioBreakdown, type Regime } from "../api/dashboards";

export function usePatrimonioBreakdown(regime: Regime = "competencia") {
  return useQuery({
    queryKey: ["dashboardPatrimonioBreakdown", regime],
    queryFn: () => fetchPatrimonioBreakdown(regime),
  });
}
