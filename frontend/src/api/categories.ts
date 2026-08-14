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

export function fetchCategoryGroups(): Promise<CategoryGroup[]> {
  return apiFetch<CategoryGroup[]>("/category-groups");
}

export function fetchSubcategories(): Promise<Subcategory[]> {
  return apiFetch<Subcategory[]>("/subcategories");
}
