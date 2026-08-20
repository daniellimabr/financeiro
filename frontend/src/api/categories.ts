import { apiFetch } from "./client";

export interface CategoryGroup {
  id: number;
  nome: string;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: number;
  group_id: number;
  nome: string;
  natureza: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcategoryUpdateInput {
  groupId: number;
  nome: string;
  natureza: string | null;
}

export interface SubcategoryCreateInput {
  groupId: number;
  nome: string;
  natureza: string | null;
}

export function fetchCategoryGroups(): Promise<CategoryGroup[]> {
  return apiFetch<CategoryGroup[]>("/category-groups");
}

export function fetchSubcategories(): Promise<Subcategory[]> {
  return apiFetch<Subcategory[]>("/subcategories");
}

export function createCategoryGroup(nome: string): Promise<CategoryGroup> {
  return apiFetch<CategoryGroup>("/category-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
}

export function updateCategoryGroup(id: number, nome: string): Promise<CategoryGroup> {
  return apiFetch<CategoryGroup>(`/category-groups/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  });
}

export function deleteCategoryGroup(id: number): Promise<void> {
  return apiFetch<void>(`/category-groups/${id}`, { method: "DELETE" });
}

export function createSubcategory(input: SubcategoryCreateInput): Promise<Subcategory> {
  return apiFetch<Subcategory>("/subcategories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_id: input.groupId, nome: input.nome, natureza: input.natureza }),
  });
}

export function updateSubcategory(id: number, input: SubcategoryUpdateInput): Promise<Subcategory> {
  return apiFetch<Subcategory>(`/subcategories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_id: input.groupId, nome: input.nome, natureza: input.natureza }),
  });
}

export function deleteSubcategory(id: number): Promise<void> {
  return apiFetch<void>(`/subcategories/${id}`, { method: "DELETE" });
}
