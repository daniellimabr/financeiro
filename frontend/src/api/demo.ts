import { apiFetch } from "./client";

// Navegação de página inteira (não fetch) — troca o cookie de sessão via
// Set-Cookie + RedirectResponse, mesmo padrão do callback do Google OAuth.
export const enterDemoUrl = "/demo/enter";

export function resetDemoAccount(): Promise<void> {
  return apiFetch<void>("/demo/reset", { method: "POST" });
}
