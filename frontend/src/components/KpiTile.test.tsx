import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KpiTile, resolveKpiDeltaPercent } from "./KpiTile";

describe("resolveKpiDeltaPercent", () => {
  it("marca como bom quando o valor sobe e positiveIsGood é true", () => {
    const result = resolveKpiDeltaPercent({
      mode: "percent",
      current: 108.3,
      previous: 100,
      positiveIsGood: true,
    });
    expect(result).toEqual({ sentiment: "good", trend: "up", text: "8,3%" });
  });

  it("marca como ruim quando o valor sobe e positiveIsGood é false (despesa)", () => {
    const result = resolveKpiDeltaPercent({
      mode: "percent",
      current: 110,
      previous: 100,
      positiveIsGood: false,
    });
    expect(result).toEqual({ sentiment: "bad", trend: "up", text: "10,0%" });
  });

  it("marca como bom quando despesa cai (positiveIsGood false, valor desce)", () => {
    const result = resolveKpiDeltaPercent({
      mode: "percent",
      current: 93.9,
      previous: 100,
      positiveIsGood: false,
    });
    expect(result).toEqual({ sentiment: "good", trend: "down", text: "6,1%" });
  });

  it("marca como neutro (flat) quando o valor não muda", () => {
    const result = resolveKpiDeltaPercent({
      mode: "percent",
      current: 100,
      previous: 100,
      positiveIsGood: true,
    });
    expect(result).toEqual({ sentiment: "flat", trend: null, text: "0,0%" });
  });

  it("retorna null quando o período anterior é zero (variação sem significado)", () => {
    const result = resolveKpiDeltaPercent({
      mode: "percent",
      current: 100,
      previous: 0,
      positiveIsGood: true,
    });
    expect(result).toBeNull();
  });
});

describe("KpiTile", () => {
  it("renderiza label e valor", () => {
    render(<KpiTile label="Receita" value="R$ 15.480,00" />);
    expect(screen.getByText("Receita")).toBeInTheDocument();
    expect(screen.getByText("R$ 15.480,00")).toBeInTheDocument();
  });

  it("renderiza delta positivo (bom) com seta pra cima", () => {
    render(
      <KpiTile
        label="Receita"
        value="R$ 15.480,00"
        delta={{ mode: "percent", current: 15480, previous: 14300, positiveIsGood: true }}
      />
    );
    const delta = screen.getByText(/8,3%/);
    expect(delta.className).toContain("good");
  });

  it("renderiza delta negativo (ruim)", () => {
    render(
      <KpiTile
        label="Despesa"
        value="R$ 15.000,00"
        delta={{ mode: "percent", current: 15000, previous: 10000, positiveIsGood: false }}
      />
    );
    const delta = screen.getByText(/50,0%/);
    expect(delta.className).toContain("bad");
  });

  it("renderiza delta zero como neutro", () => {
    render(
      <KpiTile
        label="Saldo"
        value="R$ 100,00"
        delta={{ mode: "percent", current: 100, previous: 100, positiveIsGood: true }}
      />
    );
    const delta = screen.getByText("0,0%");
    expect(delta.className).toContain("flat");
  });

  it("não renderiza delta quando o período anterior é zero", () => {
    render(
      <KpiTile
        label="Receita"
        value="R$ 100,00"
        delta={{ mode: "percent", current: 100, previous: 0, positiveIsGood: true }}
      />
    );
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("renderiza delta no modo flat (ex.: 'fluxo' do card Saldo)", () => {
    render(
      <KpiTile
        label="Saldo"
        value="R$ 4.740,00"
        delta={{ mode: "flat", label: "fluxo", title: "fluxo do mês, não é o saldo bancário" }}
      />
    );
    const badge = screen.getByText("fluxo");
    expect(badge.title).toBe("fluxo do mês, não é o saldo bancário");
  });

  it("renderiza selo de conferência quando presente", () => {
    render(<KpiTile label="Saldo Acumulado" value="R$ 8.220,00" badge={{ label: "saldo real" }} />);
    expect(screen.getByText("saldo real")).toBeInTheDocument();
  });

  it("não renderiza selo quando ausente", () => {
    render(<KpiTile label="Saldo Acumulado" value="R$ 8.220,00" />);
    expect(screen.queryByText("saldo real")).not.toBeInTheDocument();
  });

  it("renderiza a sparkline passada e não quebra sem ela", () => {
    const { rerender } = render(
      <KpiTile label="Receita" value="R$ 1,00" sparkline={<span data-testid="spark" />} />
    );
    expect(screen.getByTestId("spark")).toBeInTheDocument();

    rerender(<KpiTile label="Receita" value="R$ 1,00" />);
    expect(screen.queryByTestId("spark")).not.toBeInTheDocument();
  });

  it("renderiza como <button> e dispara onClick quando não há labelExtra", async () => {
    const onClick = vi.fn();
    render(<KpiTile label="Receita" value="R$ 1,00" onClick={onClick} />);
    const button = screen.getByRole("button", { name: /Receita/ });
    expect(button.tagName).toBe("BUTTON");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza como div role=button quando há labelExtra, evitando <button> aninhado", async () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <KpiTile
        label="Saldo Acumulado"
        value="R$ 8.220,00"
        onClick={onClick}
        onKeyDown={onKeyDown}
        labelExtra={<button type="button">próximo mês</button>}
        ariaLabel="Saldo Acumulado R$ 8.220,00"
      />
    );
    const wrapper = screen.getByRole("button", { name: "Saldo Acumulado R$ 8.220,00" });
    expect(wrapper.tagName).toBe("DIV");
    await userEvent.click(wrapper);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "próximo mês" })).toBeInTheDocument();
  });

  it("renderiza a variante compact (Ativos/Passivos/Patrimônio) sem cabeçalho/rodapé", () => {
    render(<KpiTile label="Ativos" value="R$ 397.420,00" compact />);
    const label = screen.getByText("Ativos");
    expect(label.closest(".ac-kpi--compact")).not.toBeNull();
  });

  it("aplica a variante de cor accent no valor (Saldo Acumulado)", () => {
    render(<KpiTile label="Saldo Acumulado" value="R$ 8.220,00" valueVariant="accent" />);
    const value = screen.getByText("R$ 8.220,00");
    expect(value.className).toContain("accent");
  });
});
