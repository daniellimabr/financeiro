import { useState } from "react";

import { useAssets } from "../hooks/useAssets";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useConfirmCategorization } from "../hooks/useConfirmCategorization";
import { usePendingCategorizations } from "../hooks/usePendingCategorizations";
import { useSetTransactionAsset } from "../hooks/useSetTransactionAsset";
import { useSubcategories } from "../hooks/useSubcategories";

export function CategorizationReviewPage() {
  const { data: pending, isLoading } = usePendingCategorizations();
  const { data: groups } = useCategoryGroups();
  const { data: subcategories } = useSubcategories();
  const { data: assets } = useAssets();
  const confirmCategorization = useConfirmCategorization();
  const setTransactionAsset = useSetTransactionAsset();

  const [selectedSubcategory, setSelectedSubcategory] = useState<
    Record<number, number | undefined>
  >({});
  const [selectedAsset, setSelectedAsset] = useState<Record<number, number | undefined>>({});

  function subcategoryLabel(subcategoryId: number): string {
    const subcategory = subcategories?.find((s) => s.id === subcategoryId);
    if (!subcategory) return `Subcategoria ${subcategoryId}`;
    const group = groups?.find((g) => g.id === subcategory.group_id);
    return group ? `${group.nome} / ${subcategory.nome}` : subcategory.nome;
  }

  return (
    <section>
      <h2>Categorização</h2>

      {isLoading && <p>Carregando...</p>}
      {pending?.length === 0 && <p>Nenhuma transação pendente.</p>}
      {confirmCategorization.isError && <p role="alert">Não foi possível confirmar a categoria.</p>}

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Categoria</th>
            <th>Ativo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pending?.map((tx) => {
            const subcategoryValue =
              selectedSubcategory[tx.id] ?? tx.subcategoria_sugerida_id ?? undefined;
            const assetValue = selectedAsset[tx.id] ?? tx.asset_sugerido_id ?? undefined;

            return (
              <tr key={tx.id}>
                <td>{tx.data}</td>
                <td>{tx.descricao}</td>
                <td>{tx.valor}</td>
                <td>
                  <select
                    aria-label={`Categoria de ${tx.descricao}`}
                    value={subcategoryValue ?? ""}
                    onChange={(event) =>
                      setSelectedSubcategory((prev) => ({
                        ...prev,
                        [tx.id]: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                  >
                    <option value="">Selecione...</option>
                    {subcategories?.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategoryLabel(subcategory.id)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={`Ativo de ${tx.descricao}`}
                    value={assetValue ?? ""}
                    onChange={(event) => {
                      const assetId = event.target.value ? Number(event.target.value) : null;
                      setSelectedAsset((prev) => ({ ...prev, [tx.id]: assetId ?? undefined }));
                      setTransactionAsset.mutate({ transactionId: tx.id, assetId });
                    }}
                  >
                    <option value="">Nenhum</option>
                    {assets?.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => {
                      if (subcategoryValue === undefined) return;
                      confirmCategorization.mutate({
                        transactionId: tx.id,
                        subcategoryId: subcategoryValue,
                      });
                    }}
                    disabled={subcategoryValue === undefined || confirmCategorization.isPending}
                  >
                    Confirmar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
