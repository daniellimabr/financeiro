import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PontoTendencia } from "../api/dashboards";
import { CardSparkline } from "./CardSparkline";

function ponto(ano: number, mes: number, total: string): PontoTendencia {
  return { ano, mes, total };
}

describe("CardSparkline", () => {
  it("renders nothing when there are fewer than two pontos", () => {
    const { container: empty } = render(<CardSparkline pontos={undefined} color="red" />);
    expect(empty.querySelector(".spark")).not.toBeInTheDocument();

    const { container: single } = render(
      <CardSparkline pontos={[ponto(2026, 1, "10")]} color="red" />
    );
    expect(single.querySelector(".spark")).not.toBeInTheDocument();
  });

  it("renders a spark span when there are two or more pontos", () => {
    const { container } = render(
      <CardSparkline
        pontos={[ponto(2026, 1, "10"), ponto(2026, 2, "20"), ponto(2026, 3, "15")]}
        color="red"
      />
    );
    expect(container.querySelector(".spark")).toBeInTheDocument();
  });
});
