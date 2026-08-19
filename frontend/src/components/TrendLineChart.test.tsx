import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PontoTendencia } from "../api/dashboards";
import { TrendLineChart } from "./TrendLineChart";

function ponto(ano: number, mes: number, total: string): PontoTendencia {
  return { ano, mes, total };
}

const PONTOS: PontoTendencia[] = [
  ponto(2025, 11, "100.00"),
  ponto(2025, 12, "150.00"),
  ponto(2026, 1, "200.00"),
];

describe("TrendLineChart", () => {
  it("renders nothing for spark/row with fewer than two pontos", () => {
    const { container: sparkEmpty } = render(
      <TrendLineChart pontos={undefined} color="red" variant="spark" />
    );
    expect(sparkEmpty.querySelector(".spark")).not.toBeInTheDocument();

    const { container: sparkSingle } = render(
      <TrendLineChart pontos={[ponto(2026, 1, "10")]} color="red" variant="spark" />
    );
    expect(sparkSingle.querySelector(".spark")).not.toBeInTheDocument();

    const { container: rowSingle } = render(
      <TrendLineChart pontos={[ponto(2026, 1, "10")]} color="red" variant="row" />
    );
    expect(rowSingle.querySelector(".trend")).not.toBeInTheDocument();
  });

  it("renders a spark span when there are two or more pontos", () => {
    const { container } = render(<TrendLineChart pontos={PONTOS} color="red" variant="spark" />);
    expect(container.querySelector(".spark")).toBeInTheDocument();
  });

  it("renders a dash-chart container for the card variant, even with a single ponto", () => {
    const { container } = render(
      <TrendLineChart pontos={[ponto(2026, 1, "50.00")]} color="var(--receita)" variant="card" />
    );
    expect(container.querySelector(".dash-chart")).toBeInTheDocument();
  });

  // "row" usa dimensões numéricas fixas (não "100%"), então o recharts
  // resolve o tamanho estaticamente e monta o LineChart de verdade em jsdom
  // (diferente de "spark"/"card", que dependem de ResizeObserver — ausente
  // em jsdom, ver src/test/setup.ts). Ainda assim, jsdom não calcula layout
  // real (getBoundingClientRect fica em 0), então o cálculo do recharts de
  // "qual ponto está sob o mouse" a partir de clientX/clientY não é
  // confiável em teste — simular um clique aqui testaria a matemática
  // interna do recharts sob layout inexistente, não o comportamento da
  // aplicação. A resolução do clique (índice → {ano, mes}) é testada pura
  // em utils/resolveClickedPonto.test.ts; aqui só confirma que a variante
  // "row" realmente monta (3x mais largo que os 48px do SVG manual antigo)
  // e que um clique não lança mesmo sem handler.
  it("renders a trend span (row variant) 3x wider than the old 48px SVG", () => {
    const { container } = render(<TrendLineChart pontos={PONTOS} color="red" variant="row" />);
    const wrapper = container.querySelector(".trend");
    expect(wrapper).toBeInTheDocument();
    const svg = wrapper?.querySelector("svg.recharts-surface");
    expect(svg).toHaveAttribute("width", "144");
  });

  it("does not throw when clicked, with or without onSelecionarMes", () => {
    const onSelecionarMes = vi.fn();
    const { container: withHandler } = render(
      <TrendLineChart pontos={PONTOS} color="red" variant="row" onSelecionarMes={onSelecionarMes} />
    );
    const { container: withoutHandler } = render(
      <TrendLineChart pontos={PONTOS} color="red" variant="row" />
    );

    const surfaceWith = withHandler.querySelector(".recharts-surface") as SVGSVGElement;
    const surfaceWithout = withoutHandler.querySelector(".recharts-surface") as SVGSVGElement;
    expect(() => fireEvent.click(surfaceWith, { clientX: 144, clientY: 9 })).not.toThrow();
    expect(() => fireEvent.click(surfaceWithout, { clientX: 144, clientY: 9 })).not.toThrow();
  });
});
