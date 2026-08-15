import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PontoTendencia } from "../api/dashboards";
import { TrendChart } from "./TrendChart";

const PONTOS: PontoTendencia[] = [
  { ano: 2025, mes: 11, total: "100.00" },
  { ano: 2025, mes: 12, total: "150.00" },
  { ano: 2026, mes: 1, total: "200.00" },
];

describe("TrendChart", () => {
  it("renders a dash-chart container for the given pontos", () => {
    const { container } = render(<TrendChart pontos={PONTOS} color="var(--despesa)" />);
    expect(container.querySelector(".dash-chart")).toBeInTheDocument();
  });

  it("renders without crashing for a single ponto", () => {
    const { container } = render(
      <TrendChart pontos={[{ ano: 2026, mes: 1, total: "50.00" }]} color="var(--receita)" />
    );
    expect(container.querySelector(".dash-chart")).toBeInTheDocument();
  });
});
