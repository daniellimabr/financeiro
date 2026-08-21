import type { KeyboardEvent, ReactNode } from "react";

// Tile reutilizável do sistema "Analyst Console" (Sprint 34, épico E10) —
// label + valor + delta-vs-período-anterior opcional + sparkline opcional +
// selo opcional. Serve duas densidades: a linha primária dos 5 KPIs de
// fluxo (com delta/spark) e a linha secundária Ativos/Passivos/Patrimônio
// (`compact`, sem delta/spark — não há série histórica pra esses 3 totais
// hoje; decisão do CEO na Sprint 34 foi não expandir o backend agora, ver
// PRD-034 e docs/roadmap.md).
export interface KpiDeltaPercent {
  mode: "percent";
  current: number;
  previous: number;
  // Nem toda métrica tem a mesma polaridade: Receita subindo é bom, Despesa
  // subindo é ruim — quem chama decide o que "bom" significa pra este KPI.
  positiveIsGood: boolean;
}

export interface KpiDeltaFlat {
  mode: "flat";
  label: string;
  title?: string;
}

export type KpiDelta = KpiDeltaPercent | KpiDeltaFlat;

export interface KpiBadge {
  label: string;
}

interface KpiTileProps {
  label: string;
  value: string;
  valueVariant?: "default" | "accent";
  delta?: KpiDelta;
  caption?: string;
  badge?: KpiBadge;
  sparkline?: ReactNode;
  // Elemento extra no cabeçalho, ao lado do label (ex.: seta "próximo mês"
  // do card Saldo Acumulado) — quando presente, o tile vira div+role="button"
  // em vez de <button>, pra não aninhar um <button> dentro de outro.
  labelExtra?: ReactNode;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  compact?: boolean;
  ariaLabel?: string;
}

function formatPercent1(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

// Calcula sentimento (good/bad/flat) e direção (up/down) a partir de
// current/previous — "bom" depende da polaridade que o chamador passou
// (positiveIsGood). previous === 0 não tem variação percentual com
// significado (divisão por zero), então o delta não é exibido.
export function resolveKpiDeltaPercent(delta: KpiDeltaPercent): {
  sentiment: "good" | "bad" | "flat";
  trend: "up" | "down" | null;
  text: string;
} | null {
  const { current, previous, positiveIsGood } = delta;
  if (previous === 0) return null;
  const change = current - previous;
  const pct = Math.abs((change / previous) * 100);
  if (change === 0) return { sentiment: "flat", trend: null, text: formatPercent1(0) };
  const increased = change > 0;
  const sentiment = increased === positiveIsGood ? "good" : "bad";
  return { sentiment, trend: increased ? "up" : "down", text: formatPercent1(pct) };
}

function TriangleIcon({ direction }: { direction: "up" | "down" }) {
  const path = direction === "up" ? "M5 1l4 6H1z" : "M5 9L1 3h8z";
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
      <path
        d="M2.5 6.2l2.3 2.3L9.5 3.8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeltaBadge({ delta }: { delta: KpiDelta }) {
  if (delta.mode === "flat") {
    return (
      <span className="ac-kpi-delta flat" title={delta.title}>
        {delta.label}
      </span>
    );
  }
  const resolved = resolveKpiDeltaPercent(delta);
  if (!resolved) return null;
  return (
    <span className={`ac-kpi-delta ${resolved.sentiment}`}>
      {resolved.trend && <TriangleIcon direction={resolved.trend} />}
      {resolved.text}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  valueVariant = "default",
  delta,
  caption,
  badge,
  sparkline,
  labelExtra,
  onClick,
  onKeyDown,
  compact = false,
  ariaLabel,
}: KpiTileProps) {
  const className = `ac-kpi${compact ? " ac-kpi--compact" : ""}`;
  const valueClassName = `ac-kpi-value${valueVariant === "accent" ? " accent" : ""}`;

  if (compact) {
    const content = (
      <>
        <span className="ac-kpi-label">{label}</span>
        {sparkline}
        <span className={valueClassName}>{value}</span>
      </>
    );
    return onClick ? (
      <button type="button" className={className} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
    );
  }

  const content = (
    <>
      <div className="ac-kpi-head">
        <span className="ac-kpi-label-row">
          <span className="ac-kpi-label">{label}</span>
          {labelExtra}
        </span>
        {delta && <DeltaBadge delta={delta} />}
        {badge && (
          <span className="ac-kpi-badge">
            <CheckIcon />
            {badge.label}
          </span>
        )}
      </div>
      <span className={valueClassName}>{value}</span>
      <div className="ac-kpi-foot">
        {caption && <span className="ac-kpi-caption">{caption}</span>}
        {sparkline}
      </div>
    </>
  );

  if (labelExtra) {
    // Já tem um elemento interativo (a seta) no cabeçalho — vira div+role em
    // vez de <button>, mesmo padrão já usado pelo card Saldo Acumulado antes
    // desta sprint (nested <button> é HTML inválido).
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel ?? label}
        className={className}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {content}
      </div>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
