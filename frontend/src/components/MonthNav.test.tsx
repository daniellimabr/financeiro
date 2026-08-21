import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MonthNav } from "./MonthNav";

describe("MonthNav", () => {
  it("mostra o mês e ano atuais", () => {
    render(<MonthNav ano={2026} mes={8} onChange={vi.fn()} />);
    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
  });

  it("chama onChange com o mês anterior ao clicar em 'Mês anterior'", async () => {
    const onChange = vi.fn();
    render(<MonthNav ano={2026} mes={8} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));

    expect(onChange).toHaveBeenCalledWith({ ano: 2026, mes: 7 });
  });

  it("faz rollover de ano ao pedir o mês anterior a janeiro", async () => {
    const onChange = vi.fn();
    render(<MonthNav ano={2026} mes={1} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));

    expect(onChange).toHaveBeenCalledWith({ ano: 2025, mes: 12 });
  });

  it("chama onChange com o mês seguinte ao clicar em 'Próximo mês'", async () => {
    const onChange = vi.fn();
    render(<MonthNav ano={2026} mes={3} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));

    expect(onChange).toHaveBeenCalledWith({ ano: 2026, mes: 4 });
  });

  it("desabilita 'Próximo mês' quando o filtro já está no mês corrente real", () => {
    const hoje = new Date();
    render(<MonthNav ano={hoje.getFullYear()} mes={hoje.getMonth() + 1} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeDisabled();
  });

  it("não desabilita 'Próximo mês' quando o filtro está num mês passado", () => {
    render(<MonthNav ano={2020} mes={1} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeEnabled();
  });
});
