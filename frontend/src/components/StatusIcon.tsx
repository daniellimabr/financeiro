// Indicador visual do status de categorização (Pendente/Confirmada) — mesmo
// padrão de ícone SVG inline de TransactionTipoIcon/AccountTipoIcon, mas
// aqui o ícone é o único conteúdo da célula (não decorativo ao lado de
// texto), então carrega role="img"+aria-label em vez de aria-hidden — e a
// forma difere entre os dois estados (relógio vs. check), não só a cor, pra
// não depender só de cor pra transmitir o significado.
const ICONS = {
  pendente: { path: "M8 4.7V8l2.6 1.5", className: "pending", label: "Pendente" },
  confirmada: { path: "M5 8.2l2.1 2.1L11.3 6", className: "confirmed", label: "Confirmada" },
};

export function StatusIcon({ pending }: { pending: boolean }) {
  const icon = pending ? ICONS.pendente : ICONS.confirmada;
  return (
    <svg
      className={`status-icon ${icon.className}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={icon.label}
    >
      <title>{icon.label}</title>
      <circle cx="8" cy="8" r="6.3" />
      <path d={icon.path} />
    </svg>
  );
}
