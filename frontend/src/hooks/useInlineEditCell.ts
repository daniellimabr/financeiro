import { useState } from "react";

export function useInlineEditCell({
  value,
  onSave,
  normalize = (raw: string) => raw,
}: {
  value: string;
  onSave: (value: string) => void;
  normalize?: (raw: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  function save() {
    const next = normalize(draft);
    setEditing(false);
    if (!next || next === value) return;
    onSave(next);
  }

  function cancel() {
    setEditing(false);
  }

  return { editing, draft, setDraft, startEditing, save, cancel };
}
