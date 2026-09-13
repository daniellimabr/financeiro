import type { Asset } from "../api/assets";
import type { CategoryGroup, Subcategory } from "../api/categories";
import type { Investimento } from "../api/investimentos";
import { useInlineEditCell } from "../hooks/useInlineEditCell";
import { useSetCategory } from "../hooks/useSetCategory";
import { useSetTransactionAsset } from "../hooks/useSetTransactionAsset";
import { useSetTransactionInvestimento } from "../hooks/useSetTransactionInvestimento";
import { useUpdateDate } from "../hooks/useUpdateDate";
import { useUpdateDescription } from "../hooks/useUpdateDescription";
import { descricaoExibida, type EditableTransaction } from "../utils/transactionEdit";
import { CategoryCombobox } from "./CategoryCombobox";

function InlineEditInput({
  type,
  ariaLabel,
  draft,
  setDraft,
  save,
  cancel,
}: {
  type?: string;
  ariaLabel: string;
  draft: string;
  setDraft: (value: string) => void;
  save: () => void;
  cancel: () => void;
}) {
  return (
    <input
      type={type}
      aria-label={ariaLabel}
      value={draft}
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") save();
        if (event.key === "Escape") cancel();
      }}
    />
  );
}

export function DescriptionCell({ transaction }: { transaction: EditableTransaction }) {
  const updateDescription = useUpdateDescription();
  const exibida = descricaoExibida(transaction);
  const { editing, draft, setDraft, startEditing, save, cancel } = useInlineEditCell({
    value: exibida,
    onSave: (descricao) => updateDescription.mutate({ transactionId: transaction.id, descricao }),
    normalize: (raw) => raw.trim(),
  });

  return editing ? (
    <InlineEditInput
      ariaLabel={`Editar descrição de ${exibida}`}
      draft={draft}
      setDraft={setDraft}
      save={save}
      cancel={cancel}
    />
  ) : (
    <button type="button" onClick={startEditing} title="Clique para editar a descrição">
      {exibida}
    </button>
  );
}

export function DateCell({ transaction }: { transaction: EditableTransaction }) {
  const updateDate = useUpdateDate();
  const exibida = descricaoExibida(transaction);
  const { editing, draft, setDraft, startEditing, save, cancel } = useInlineEditCell({
    value: transaction.data,
    onSave: (data) => updateDate.mutate({ transactionId: transaction.id, data }),
  });

  return editing ? (
    <InlineEditInput
      type="date"
      ariaLabel={`Editar data de ${exibida}`}
      draft={draft}
      setDraft={setDraft}
      save={save}
      cancel={cancel}
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

export function InvestimentoSelectCell({
  transaction,
  investimentos,
}: {
  transaction: EditableTransaction;
  investimentos: Investimento[] | undefined;
}) {
  const setTransactionInvestimento = useSetTransactionInvestimento();
  const value = transaction.investimento_sugerido_id ?? transaction.investimento_id ?? undefined;

  return (
    <select
      aria-label={`Investimento de ${descricaoExibida(transaction)}`}
      value={value ?? ""}
      onChange={(event) => {
        const investimentoId = event.target.value ? Number(event.target.value) : null;
        setTransactionInvestimento.mutate({ transactionId: transaction.id, investimentoId });
      }}
    >
      <option value="">Nenhum</option>
      {investimentos?.map((investimento) => (
        <option key={investimento.id} value={investimento.id}>
          {investimento.nome}
        </option>
      ))}
    </select>
  );
}
