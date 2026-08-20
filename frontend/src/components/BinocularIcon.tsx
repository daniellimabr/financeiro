// Ícone de binóculo — mesmo padrão de ícone SVG inline decorativo de
// AccountTipoIcon.tsx (viewBox 16x16, stroke currentColor), usado aqui como
// alvo de um botão interativo (toggle "ocultar gasto", Sprint 27), não só
// decorativo — por isso vive em componente próprio em vez de entrar no mapa
// de AccountTipoIcon.
export function BinocularIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="4.5" cy="10.5" r="3" />
      <circle cx="11.5" cy="10.5" r="3" />
      <path d="M7.5 9.5h1M5.5 3.5 4.5 7.3M10.5 3.5l1 3.8" />
    </svg>
  );
}
