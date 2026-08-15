// Indicador visual de direção do fluxo (débito/crédito) — mesmo padrão
// visual de AccountTipoIcon (SVG inline 14x14, aria-hidden, currentColor),
// adicionado à tela de Categorização na Sprint 10 depois da confusão real do
// CEO sobre uma transação de despesa aparecendo como receita (achado NuTag).
const ICONS: Record<string, { path: string; className: string }> = {
  debito: { path: "M3 6.5 8 12l5-5.5M8 11.5v-9", className: "despesa" },
  credito: { path: "M3 9.5 8 4l5 5.5M8 4.5v9", className: "receita" },
};

export function TransactionTipoIcon({ tipo }: { tipo: string }) {
  const icon = ICONS[tipo];
  if (!icon) return null;
  return (
    <svg
      className={`transaction-tipo-icon ${icon.className}`}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icon.path} />
    </svg>
  );
}
