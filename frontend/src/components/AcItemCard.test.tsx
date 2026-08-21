import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AcItemCard } from "./AcItemCard";

describe("AcItemCard", () => {
  it("renderiza tipo, valor e nome", () => {
    render(<AcItemCard tipo="Veículo" valor="R$ 50.000,00" nome="Carro" />);
    expect(screen.getByText("Veículo")).toBeInTheDocument();
    expect(screen.getByText("R$ 50.000,00")).toBeInTheDocument();
    expect(screen.getByText("Carro")).toBeInTheDocument();
  });

  it("renderiza a tag quando presente", () => {
    render(
      <AcItemCard tipo="Veículo" valor="R$ 50.000,00" nome="Carro" tag="Adquirido em 2024-01-01" />
    );
    expect(screen.getByText("Adquirido em 2024-01-01")).toBeInTheDocument();
  });

  it("não renderiza tag quando ausente", () => {
    const { container } = render(<AcItemCard tipo="Veículo" valor="R$ 50.000,00" nome="Carro" />);
    expect(container.querySelector(".ac-item-tag")).not.toBeInTheDocument();
  });

  it("renderiza a sparkline passada e não quebra sem ela", () => {
    const { container, rerender } = render(
      <AcItemCard
        tipo="Veículo"
        valor="R$ 50.000,00"
        nome="Carro"
        sparkline={<span data-testid="spark" />}
      />
    );
    expect(screen.getByTestId("spark")).toBeInTheDocument();

    rerender(<AcItemCard tipo="Veículo" valor="R$ 50.000,00" nome="Carro" />);
    expect(screen.queryByTestId("spark")).not.toBeInTheDocument();
    expect(container.querySelector(".ac-item-card")).toBeInTheDocument();
  });

  it("renderiza o grupo de botões de ação via children", async () => {
    const onEdit = vi.fn();
    render(
      <AcItemCard tipo="Veículo" valor="R$ 50.000,00" nome="Carro">
        <button type="button" onClick={onEdit}>
          Editar
        </button>
        <button type="button">Excluir</button>
      </AcItemCard>
    );
    const editar = screen.getByRole("button", { name: "Editar" });
    expect(editar).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    await userEvent.click(editar);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("não renderiza o wrapper de botões quando não há children", () => {
    const { container } = render(<AcItemCard tipo="Veículo" valor="R$ 50.000,00" nome="Carro" />);
    expect(container.querySelector(".ac-btn-row")).not.toBeInTheDocument();
  });

  it("aplica a classe secondary na variante secundária (baixados/quitados)", () => {
    const { container } = render(
      <AcItemCard tipo="Veículo" valor="R$ 7.000,00" nome="Moto antiga" secondary />
    );
    expect(container.querySelector(".ac-item-card.secondary")).toBeInTheDocument();
  });

  it("não aplica secondary por padrão", () => {
    const { container } = render(<AcItemCard tipo="Veículo" valor="R$ 50.000,00" nome="Carro" />);
    expect(container.querySelector(".ac-item-card.secondary")).not.toBeInTheDocument();
    expect(container.querySelector(".ac-item-card")).toBeInTheDocument();
  });
});
