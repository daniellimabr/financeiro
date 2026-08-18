import { useQuery } from "@tanstack/react-query";

import { fetchBaselineProposal } from "../api/pluggy";

export function useBaselineProposal(enabled: boolean) {
  return useQuery({
    queryKey: ["baselineProposalDez2025"],
    queryFn: fetchBaselineProposal,
    enabled,
  });
}
