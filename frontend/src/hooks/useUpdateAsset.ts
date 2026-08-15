import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateAsset, type AssetInput } from "../api/assets";

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, input }: { assetId: number; input: AssetInput }) =>
      updateAsset(assetId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
