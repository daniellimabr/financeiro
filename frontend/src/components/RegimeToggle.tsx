import type { Regime } from "../api/dashboards";

interface RegimeToggleProps {
  value: Regime;
  onChange: (regime: Regime) => void;
}

export function RegimeToggle({ value, onChange }: RegimeToggleProps) {
  return (
    <div className="dash-toggle" role="group" aria-label="Regime">
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
