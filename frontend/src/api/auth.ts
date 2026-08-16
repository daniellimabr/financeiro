import { apiFetch } from "./client";

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  salario_competencia_cutoff_dia: number;
  created_at: string;
}

export const GOOGLE_LOGIN_URL = "/auth/google/login";

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me");
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function updateUserSettings(cutoffDia: number): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cutoff_dia: cutoffDia }),
  });
}
