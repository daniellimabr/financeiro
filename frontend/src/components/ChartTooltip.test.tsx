import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartTooltip, formatMonthShort } from "./ChartTooltip";

describe("formatMonthShort", () => {
  it("formata mês/ano abreviado em pt-BR", () => {
    expect(formatMonthShort(5, 2026)).toBe("mai/26");
    expect(formatMonthShort(1, 2025)).toBe("jan/25");
    expect(formatMonthShort(12, 2026)).toBe("dez/26");
  });

  it("usa o número do mês como fallback quando ele está fora do intervalo 1-12", () => {
    expect(formatMonthShort(13, 2026)).toBe("13/26");
  });
});

describe("ChartTooltip", () => {
  const PAYLOAD = [{ graphicalItemId: "0", payload: { ano: 2026, mes: 5, total: 15400 } }];

  it("não renderiza quando inativo", () => {
    const { container } = render(<ChartTooltip active={false} payload={PAYLOAD} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza sem payload", () => {
    const { container } = render(<ChartTooltip active payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza quando o ponto ativo não tem payload próprio", () => {
    const { container } = render(<ChartTooltip active payload={[{ graphicalItemId: "0" }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra mês abreviado e valor exato formatado ao passar o mouse", () => {
    render(<ChartTooltip active payload={PAYLOAD} />);
    expect(screen.getByText("mai/26")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*15\.400,00/)).toBeInTheDocument();
  });
});
