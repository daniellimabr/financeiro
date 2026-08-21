import { isMesAtual, mesAnterior, mesSeguinte } from "../utils/monthNav";

// Seta decorativa (◀/▶) — extraída de DashboardsPage.tsx junto com MonthNav
// (Sprint 34 a introduziu pro card Saldo Acumulado, Sprint 36/PRD-036b
// promove os dois a componente compartilhado). Mesmo padrão de ícone SVG
// inline de AccountTipoIcon.tsx (viewBox 16x16, stroke currentColor).
export function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M10 2.5 4 8l6 5.5M4 8h8" : "M6 2.5 12 8l-6 5.5M12 8H4";
  return (
    <svg
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
      <path d={path} />
    </svg>
  );
}

const MESES_COMPLETOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// Navegador de mês (◀ mês ▶) — introduzido pela toolbar do Dashboard
// (Sprint 34) substituindo o filtro ano/mês simples (PeriodFilter, que
// continua servindo as telas que não migraram pro Analyst Console).
// Promovido a componente compartilhado na Sprint 36 (PRD-036b) quando
// Investimentos se tornou a segunda tela a precisar dele. Nunca avança além
// do mês corrente real (botão "próximo" desabilitado, não só um alerta).
export function MonthNav({
  ano,
  mes,
  onChange,
}: {
  ano: number;
  mes: number;
  onChange: (proximo: { ano: number; mes: number }) => void;
}) {
  return (
    <div className="ac-month-nav" role="group" aria-label="Navegar entre meses">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(mesAnterior(ano, mes))}
      >
        <ArrowIcon direction="left" />
      </button>
      <span className="current">
        {MESES_COMPLETOS[mes - 1]} {ano}
      </span>
      <button
        type="button"
        aria-label="Próximo mês"
        disabled={isMesAtual(ano, mes)}
        onClick={() => onChange(mesSeguinte(ano, mes))}
      >
        <ArrowIcon direction="right" />
      </button>
    </div>
  );
}
