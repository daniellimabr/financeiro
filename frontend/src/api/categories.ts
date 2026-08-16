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

export function fetchCategoryGroups(): Promise<CategoryGroup[]> {
  return apiFetch<CategoryGroup[]>("/category-groups");
}

export function fetchSubcategories(): Promise<Subcategory[]> {
  return apiFetch<Subcategory[]>("/subcategories");
}

export function updateSubcategory(id: number, input: SubcategoryUpdateInput): Promise<Subcategory> {
  return apiFetch<Subcategory>(`/subcategories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_id: input.groupId, nome: input.nome, natureza: input.natureza }),
  });
}
