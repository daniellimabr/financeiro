import { useMemo, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import type { CategoryGroup, Subcategory } from "../api/categories";
import { SubcategoryGroupTable } from "../components/SubcategoryGroupTable";
import { useCategoryGroups } from "../hooks/useCategoryGroups";
import { useCreateCategoryGroup } from "../hooks/useCreateCategoryGroup";
import { useCreateSubcategory } from "../hooks/useCreateSubcategory";
import { useDeleteCategoryGroup } from "../hooks/useDeleteCategoryGroup";
import { useDeleteSubcategory } from "../hooks/useDeleteSubcategory";
import { useSubcategories } from "../hooks/useSubcategories";
import { useUpdateCategoryGroup } from "../hooks/useUpdateCategoryGroup";
import { useUpdateSubcategory } from "../hooks/useUpdateSubcategory";

const DELETE_EM_USO_MESSAGE =
  "Não é possível excluir: há transações, regras de categorização ou orçamentos vinculados.";

export function CategoriasPage() {
  const groupsQuery = useCategoryGroups();
  const subcategoriesQuery = useSubcategories();
  const createGroup = useCreateCategoryGroup();
  const updateGroup = useUpdateCategoryGroup();
  const deleteGroup = useDeleteCategoryGroup();
  const createSubcategory = useCreateSubcategory();
  const updateSubcategory = useUpdateSubcategory();
  const deleteSubcategory = useDeleteSubcategory();

  const [sortKey, setSortKey] = useState<"grupo" | "subcategoria">("grupo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupNome, setGroupNome] = useState("");

  const [subFormOpen, setSubFormOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subNome, setSubNome] = useState("");
  const [subGroupId, setSubGroupId] = useState<number | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const groups = groupsQuery.data;
  const subcategories = subcategoriesQuery.data;

  const gruposComSubcategorias = useMemo(() => {
    const porGrupo = new Map<number, Subcategory[]>();
    for (const sub of subcategories ?? []) {
      const lista = porGrupo.get(sub.group_id) ?? [];
      lista.push(sub);
      porGrupo.set(sub.group_id, lista);
    }
    return (groups ?? []).map((group) => ({
      group,
      subcategorias: (porGrupo.get(group.id) ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
    }));
  }, [groups, subcategories]);

  const gruposOrdenados = useMemo(() => {
    const cmp = (a: string, b: string) => a.localeCompare(b) * (sortDirection === "asc" ? 1 : -1);
    const entries = gruposComSubcategorias.map((entry) =>
      sortKey === "subcategoria"
        ? {
            group: entry.group,
            subcategorias: [...entry.subcategorias].sort((a, b) => cmp(a.nome, b.nome)),
          }
        : entry
    );
    if (sortKey === "grupo") {
      entries.sort((a, b) => cmp(a.group.nome, b.group.nome));
    }
    return entries;
  }, [gruposComSubcategorias, sortKey, sortDirection]);

  function toggleSort(key: "grupo" | "subcategoria") {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function openCreateGroupForm() {
    setEditingGroupId(null);
    setGroupNome("");
    setGroupFormOpen(true);
  }

  function openEditGroupForm(group: CategoryGroup) {
    setEditingGroupId(group.id);
    setGroupNome(group.nome);
    setGroupFormOpen(true);
  }

  function submitGroupForm(event: FormEvent) {
    event.preventDefault();
    if (editingGroupId !== null) {
      updateGroup.mutate(
        { groupId: editingGroupId, nome: groupNome },
        { onSuccess: () => setGroupFormOpen(false) }
      );
    } else {
      createGroup.mutate(groupNome, { onSuccess: () => setGroupFormOpen(false) });
    }
  }

  async function handleDeleteGroup(group: CategoryGroup) {
    if (!window.confirm(`Excluir o grupo "${group.nome}"?`)) return;
    setDeleteError(null);
    try {
      await deleteGroup.mutateAsync(group.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setDeleteError(DELETE_EM_USO_MESSAGE);
      } else {
        setDeleteError("Não foi possível excluir o grupo.");
      }
    }
  }

  function openCreateSubForm(groupId: number) {
    setEditingSubcategory(null);
    setSubNome("");
    setSubGroupId(groupId);
    setSubFormOpen(true);
  }

  function openEditSubForm(sub: Subcategory) {
    setEditingSubcategory(sub);
    setSubNome(sub.nome);
    setSubGroupId(sub.group_id);
    setSubFormOpen(true);
  }

  function submitSubForm(event: FormEvent) {
    event.preventDefault();
    if (subGroupId === null) return;
    if (editingSubcategory !== null) {
      updateSubcategory.mutate(
        { subcategory: editingSubcategory, nome: subNome, groupId: subGroupId },
        { onSuccess: () => setSubFormOpen(false) }
      );
    } else {
      createSubcategory.mutate(
        { groupId: subGroupId, nome: subNome, natureza: null },
        { onSuccess: () => setSubFormOpen(false) }
      );
    }
  }

  async function handleDeleteSubcategory(sub: Subcategory) {
    if (!window.confirm(`Excluir a subcategoria "${sub.nome}"?`)) return;
    setDeleteError(null);
    try {
      await deleteSubcategory.mutateAsync(sub.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setDeleteError(DELETE_EM_USO_MESSAGE);
      } else {
        setDeleteError("Não foi possível excluir a subcategoria.");
      }
    }
  }

  return (
    <section className="dash-page">
      <h2>Categorias</h2>

      <div className="dash-filter">
        <button type="button" onClick={openCreateGroupForm}>
          Novo grupo
        </button>
      </div>

      {(createGroup.isError || updateGroup.isError) && (
        <p role="alert">Não foi possível salvar o grupo.</p>
      )}
      {(createSubcategory.isError || updateSubcategory.isError) && (
        <p role="alert">Não foi possível salvar a subcategoria.</p>
      )}
      {deleteError && <p role="alert">{deleteError}</p>}

      {groupFormOpen && (
        <div role="dialog" aria-label={editingGroupId !== null ? "Editar grupo" : "Novo grupo"}>
          <form className="dash-filter" onSubmit={submitGroupForm}>
            <label>
              Nome do grupo
              <input
                aria-label="Nome do grupo"
                value={groupNome}
                required
                onChange={(event) => setGroupNome(event.target.value)}
              />
            </label>
            <button type="submit" disabled={createGroup.isPending || updateGroup.isPending}>
              Salvar
            </button>
            <button type="button" onClick={() => setGroupFormOpen(false)}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {subFormOpen && (
        <div
          role="dialog"
          aria-label={editingSubcategory !== null ? "Editar subcategoria" : "Nova subcategoria"}
        >
          <form className="dash-filter" onSubmit={submitSubForm}>
            <label>
              Nome da subcategoria
              <input
                aria-label="Nome da subcategoria"
                value={subNome}
                required
                onChange={(event) => setSubNome(event.target.value)}
              />
            </label>
            <label>
              Grupo
              <select
                aria-label="Grupo da subcategoria"
                value={subGroupId ?? ""}
                required
                onChange={(event) => setSubGroupId(Number(event.target.value))}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {(groups ?? []).map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={createSubcategory.isPending || updateSubcategory.isPending}
            >
              Salvar
            </button>
            <button type="button" onClick={() => setSubFormOpen(false)}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      {groupsQuery.isLoading && <p>Carregando...</p>}
      {groupsQuery.isError && <p role="alert">Não foi possível carregar as categorias.</p>}

      <SubcategoryGroupTable
        grupos={gruposOrdenados}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        terceiraColunaLabel="Ações"
        renderGroupCell={(group) => (
          <>
            {group.nome}
            <div className="dash-filter">
              <button className="btn-ghost" type="button" onClick={() => openEditGroupForm(group)}>
                Editar
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => openCreateSubForm(group.id)}
              >
                Nova subcategoria
              </button>
              <button
                className="btn-ghost btn-quiet btn-danger"
                type="button"
                onClick={() => handleDeleteGroup(group)}
              >
                Excluir
              </button>
            </div>
          </>
        )}
        renderEmptyGroupRow={() => (
          <span className="dash-empty">Nenhuma subcategoria neste grupo.</span>
        )}
        renderThirdColumn={(sub) => (
          <div className="dash-filter">
            <button className="btn-ghost" type="button" onClick={() => openEditSubForm(sub)}>
              Editar
            </button>
            <button
              className="btn-ghost btn-quiet btn-danger"
              type="button"
              onClick={() => handleDeleteSubcategory(sub)}
            >
              Excluir
            </button>
          </div>
        )}
      />
    </section>
  );
}
