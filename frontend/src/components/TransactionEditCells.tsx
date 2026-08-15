import { useState } from "react";

import type { Asset } from "../api/assets";
import type { CategoryGroup, Subcategory } from "../api/categories";
import { useConfirmDescriptionSuggestion } from "../hooks/useConfirmDescriptionSuggestion";
import { useDismissDescriptionSuggestion } from "../hooks/useDismissDescriptionSuggestion";
import { useSetCategory } from "../hooks/useSetCategory";
import { useSetTransactionAsset } from "../hooks/useSetTransactionAsset";
import { useUpdateDescription } from "../hooks/useUpdateDescription";
import { descricaoExibida, type EditableTransaction } from "../utils/transactionEdit";

export function DescriptionCell({ transaction }: { transaction: EditableTransaction }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const updateDescription = useUpdateDescription();
  const confirmSuggestion = useConfirmDescriptionSuggestion();
  const dismissSuggestion = useDismissDescriptionSuggestion();
  const exibida = descricaoExibida(transaction);

  function startEditing() {
    setDraft(exibida);
    setEditing(true);
  }

  function save() {
    const value = draft.trim();
    setEditing(false);
    if (!value || value === exibida) return;
    updateDescription.mutate({ transactionId: transaction.id, descricao: value });
  }

  return (
    <>
      {editing ? (
        <input
          aria-label={`Editar descrição de ${exibida}`}
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <button type="button" onClick={startEditing} title="Clique para editar a descrição">
          {exibida}
        </button>
      )}
      {transaction.descricao_sugerida !== null && (
        <div>
          <span>Sugestão: {transaction.descricao_sugerida}</span>
          <button type="button" onClick={() => confirmSuggestion.mutate(transaction.id)}>
            Aceitar
          </button>
          <button type="button" onClick={() => dismissSuggestion.mutate(transaction.id)}>
            Descartar
          </button>
        </div>
      )}
    </>
  );
}

export function CategorySelectCell({
  transaction,
  subcategories,
  groups,
}: {
  transaction: EditableTransaction;
  subcategories: Subcategory[] | undefined;
  groups: CategoryGroup[] | undefined;
}) {
  const setCategory = useSetCategory();
  const value = transaction.subcategoria_sugerida_id ?? transaction.subcategory_id ?? undefined;

  function label(subcategoryId: number): string {
    const subcategory = subcategories?.find((s) => s.id === subcategoryId);
    if (!subcategory) return `Subcategoria ${subcategoryId}`;
    const group = groups?.find((g) => g.id === subcategory.group_id);
    return group ? `${group.nome} / ${subcategory.nome}` : subcategory.nome;
  }

  return (
    <select
      aria-label={`Categoria de ${descricaoExibida(transaction)}`}
      value={value ?? ""}
      onChange={(event) => {
        const subcategoryId = event.target.value ? Number(event.target.value) : undefined;
        if (subcategoryId !== undefined) {
          setCategory.mutate({ transactionId: transaction.id, subcategoryId });
        }
      }}
    >
      <option value="">Selecione...</option>
      {subcategories?.map((subcategory) => (
        <option key={subcategory.id} value={subcategory.id}>
          {label(subcategory.id)}
        </option>
      ))}
    </select>
  );
}

export function AssetSelectCell({
  transaction,
  assets,
}: {
  transaction: EditableTransaction;
  assets: Asset[] | undefined;
}) {
  const setTransactionAsset = useSetTransactionAsset();
  const value = transaction.asset_sugerido_id ?? transaction.asset_id ?? undefined;

  return (
    <select
      aria-label={`Ativo de ${descricaoExibida(transaction)}`}
      value={value ?? ""}
      onChange={(event) => {
        const assetId = event.target.value ? Number(event.target.value) : null;
        setTransactionAsset.mutate({ transactionId: transaction.id, assetId });
      }}
    >
      <option value="">Nenhum</option>
      {assets?.map((asset) => (
        <option key={asset.id} value={asset.id}>
          {asset.nome}
        </option>
      ))}
    </select>
  );
}
