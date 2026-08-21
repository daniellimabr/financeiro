import type { Regime } from "../api/dashboards";

interface RegimeToggleProps {
  value: Regime;
  onChange: (regime: Regime) => void;
  // "ac" (Sprint 34) — troca a classe do wrapper de .dash-toggle (sistema
  // antigo) pra .ac-seg (Analyst Console), sem duplicar o componente. Só o
  // Dashboard usa "ac" hoje; as outras 8 telas continuam no default.
  variant?: "default" | "ac";
}

export function RegimeToggle({ value, onChange, variant = "default" }: RegimeToggleProps) {
  return (
    <div className={variant === "ac" ? "ac-seg" : "dash-toggle"} role="group" aria-label="Regime">
      <button
        type="button"
        aria-pressed={value === "competencia"}
        onClick={() => onChange("competencia")}
      >
        Competência
      </button>
      <button type="button" aria-pressed={value === "caixa"} onClick={() => onChange("caixa")}>
        Caixa
      </button>
    </div>
  );
}
