import { useState } from "react";

import type { Asset } from "../api/assets";
import type { CategoryGroup, Subcategory } from "../api/categories";
import { useSetCategory } from "../hooks/useSetCategory";
import { useSetTransactionAsset } from "../hooks/useSetTransactionAsset";
import { useUpdateDate } from "../hooks/useUpdateDate";
import { useUpdateDescription } from "../hooks/useUpdateDescription";
import { descricaoExibida, type EditableTransaction } from "../utils/transactionEdit";
import { CategoryCombobox } from "./CategoryCombobox";

export function DescriptionCell({ transaction }: { transaction: EditableTransaction }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const updateDescription = useUpdateDescription();
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

  return editing ? (
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
  );
}

export function DateCell({ transaction }: { transaction: EditableTransaction }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const updateDate = useUpdateDate();
  const exibida = descricaoExibida(transaction);

  function startEditing() {
    setDraft(transaction.data);
    setEditing(true);
  }

  function save() {
    const value = draft;
    setEditing(false);
    if (!value || value === transaction.data) return;
    updateDate.mutate({ transactionId: transaction.id, data: value });
  }

  return editing ? (
    <input
      type="date"
      aria-label={`Editar data de ${exibida}`}
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
    <button type="button" onClick={startEditing} title="Clique para editar a data">
      {transaction.data}
      {transaction.data_editada_manualmente && (
        <span
          className="date-edited-indicator"
          role="img"
          aria-label="Data editada manualmente"
          title="Data editada manualmente — não é sobrescrita por sincronizações futuras da Pluggy"
        >
          ✎
        </span>
      )}
    </button>
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

  return (
    <CategoryCombobox
      ariaLabel={`Categoria de ${descricaoExibida(transaction)}`}
      groups={groups}
      subcategories={subcategories}
      value={value}
      onChange={(subcategoryId) =>
        setCategory.mutate({ transactionId: transaction.id, subcategoryId })
      }
    />
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
