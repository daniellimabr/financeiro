import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  corrente: (
    <path d="M1 6.5 8 2l7 4.5M2.5 6.5v7M5.5 6.5v7M10.5 6.5v7M13.5 6.5v7M1 13.5h14M1 6.5h14" />
  ),
  poupanca: (
    <path d="M2 8.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5-2.7 5-6 5c-.8 0-1.6-.15-2.3-.42L3 14l.6-2.3C2.6 10.9 2 9.75 2 8.5Z" />
  ),
  cartao_credito: (
    <path d="M1.5 4h13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M1 6.5h14M3 10h3" />
  ),
  investimento: <path d="M1.5 13.5 6 8l3 3 5.5-6.5M11 4.5h3.5V8" />,
};

export function AccountTipoIcon({ tipo }: { tipo: string }) {
  const path = ICONS[tipo];
  if (!path) return null;
  return (
    <svg
      className="account-tipo-icon"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
