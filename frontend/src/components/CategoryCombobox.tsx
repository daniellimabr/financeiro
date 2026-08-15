import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import type { CategoryGroup, Subcategory } from "../api/categories";
import { subcategoryLabel } from "../utils/transactionEdit";

interface CategoryComboboxProps {
  groups: CategoryGroup[] | undefined;
  subcategories: Subcategory[] | undefined;
  value: number | undefined;
  onChange: (subcategoryId: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}

interface GroupedOptions {
  group: CategoryGroup;
  options: Subcategory[];
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CategoryCombobox({
  groups,
  subcategories,
  value,
  onChange,
  ariaLabel,
  disabled,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeOverride, setActiveOverride] = useState<number | null>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const filteredGroups = useMemo<GroupedOptions[]>(() => {
    if (!groups || !subcategories) return [];
    const q = normalize(query);
    return groups
      .map((group) => ({
        group,
        options: subcategories.filter((sub) => {
          if (sub.group_id !== group.id) return false;
          if (!q) return true;
          return normalize(sub.nome).includes(q) || normalize(group.nome).includes(q);
        }),
      }))
      .filter((entry) => entry.options.length > 0);
  }, [groups, subcategories, query]);

  const flatOptions = useMemo(
    () => filteredGroups.flatMap((entry) => entry.options),
    [filteredGroups]
  );

  const activeId = useMemo(() => {
    if (activeOverride !== null && flatOptions.some((option) => option.id === activeOverride)) {
      return activeOverride;
    }
    return flatOptions[0]?.id ?? null;
  }, [activeOverride, flatOptions]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      setOpen(false);
      setQuery("");
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  function openPopup() {
    if (disabled || open) return;
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      setPopupStyle({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    setOpen(true);
    setQuery("");
  }

  function closeWithoutApplying() {
    setOpen(false);
    setQuery("");
    setActiveOverride(null);
  }

  function selectOption(subcategoryId: number) {
    onChange(subcategoryId);
    setOpen(false);
    setQuery("");
    setActiveOverride(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openPopup();
        return;
      }
      const index = flatOptions.findIndex((option) => option.id === activeId);
      const next = flatOptions[Math.min(flatOptions.length - 1, index + 1)] ?? flatOptions[0];
      setActiveOverride(next?.id ?? null);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openPopup();
        return;
      }
      const index = flatOptions.findIndex((option) => option.id === activeId);
      const prev = flatOptions[Math.max(0, index - 1)] ?? flatOptions[flatOptions.length - 1];
      setActiveOverride(prev?.id ?? null);
    } else if (event.key === "Enter") {
      if (open && activeId !== null) {
        event.preventDefault();
        selectOption(activeId);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        closeWithoutApplying();
      }
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (rootRef.current?.contains(next)) return;
    if (popupRef.current?.contains(next)) return;
    setOpen(false);
    setQuery("");
  }

  const selectedLabel = value !== undefined ? subcategoryLabel(value, subcategories, groups) : "";
  const displayValue = open ? query : selectedLabel;

  return (
    <div className="cat-combobox" ref={rootRef} onBlur={handleBlur}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId !== null ? `${listboxId}-opt-${activeId}` : undefined}
        aria-label={ariaLabel}
        className="cat-combobox-input"
        disabled={disabled}
        placeholder="Selecione..."
        value={displayValue}
        onFocus={openPopup}
        onClick={openPopup}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {open &&
        createPortal(
          <ul
            ref={popupRef}
            className="cat-combobox-popup"
            role="listbox"
            id={listboxId}
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              top: popupStyle.top,
              left: popupStyle.left,
              width: popupStyle.width,
            }}
          >
            {flatOptions.length === 0 && (
              <li className="cat-combobox-empty" role="presentation">
                Nenhum resultado
              </li>
            )}
            {filteredGroups.map(({ group, options }) => (
              <Fragment key={group.id}>
                <li className="cat-combobox-group-label" role="presentation">
                  {group.nome}
                </li>
                {options.map((option) => (
                  <li
                    key={option.id}
                    id={`${listboxId}-opt-${option.id}`}
                    role="option"
                    aria-selected={option.id === value}
                    className={`cat-combobox-option${option.id === activeId ? " active" : ""}${
                      option.id === value ? " selected" : ""
                    }`}
                    onMouseEnter={() => setActiveOverride(option.id)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option.id)}
                  >
                    {option.nome}
                  </li>
                ))}
              </Fragment>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
