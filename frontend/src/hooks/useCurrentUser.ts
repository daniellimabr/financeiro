import { useQuery } from "@tanstack/react-query";

import { fetchCurrentUser } from "../api/auth";
import { ApiError } from "../api/client";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}
