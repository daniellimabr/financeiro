import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sellAsset, type AssetSellInput } from "../api/assets";

export function useSellAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, input }: { assetId: number; input: AssetSellInput }) =>
      sellAsset(assetId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
