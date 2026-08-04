import { apiFetch } from "./client";

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export const GOOGLE_LOGIN_URL = "/auth/google/login";

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me");
}
