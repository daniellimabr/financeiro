import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CategoryGroup, Subcategory } from "../api/categories";
import { CategoryCombobox } from "./CategoryCombobox";

const GROUPS: CategoryGroup[] = [
  { id: 1, nome: "Alimentação", created_at: "", updated_at: "" },
  { id: 2, nome: "Transporte", created_at: "", updated_at: "" },
];

const SUBCATEGORIES: Subcategory[] = [
  {
    id: 10,
    group_id: 1,
    nome: "Supermercado",
    natureza: "variavel",
    created_at: "",
    updated_at: "",
  },
  {
    id: 11,
    group_id: 1,
    nome: "Restaurante",
    natureza: "variavel",
    created_at: "",
    updated_at: "",
  },
  {
    id: 20,
    group_id: 2,
    nome: "Combustível",
    natureza: "variavel",
    created_at: "",
    updated_at: "",
  },
];

function renderCombobox(overrides: Partial<Parameters<typeof CategoryCombobox>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <CategoryCombobox
      ariaLabel="Categoria de Mercado São João"
      groups={GROUPS}
      subcategories={SUBCATEGORIES}
      value={undefined}
      onChange={onChange}
      {...overrides}
    />
  );
  return { onChange };
}

describe("CategoryCombobox", () => {
  it("shows the selected label when closed", () => {
    renderCombobox({ value: 10 });
    const input = screen.getByLabelText("Categoria de Mercado São João") as HTMLInputElement;
    expect(input.value).toBe("Alimentação / Supermercado");
  });

  it("opens via click and lists subcategories grouped by category, with non-selectable group headers", async () => {
    renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");

    await userEvent.click(input);

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("scrolling inside the popup's own list does not close it (regression: window scroll listener misfired on the popup's own overflow-y:auto)", async () => {
    renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");
    await userEvent.click(input);

    fireEvent.scroll(screen.getByRole("listbox"));

    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("scrolling outside the popup closes it", async () => {
    renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");
    await userEvent.click(input);

    fireEvent.scroll(document);

    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("opens via keyboard navigation (focus)", async () => {
    renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");

    input.focus();

    expect(await screen.findByRole("listbox")).toBeInTheDocument();
  });

  it("filters options by typing, case/accent-insensitive", async () => {
    renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");

    await userEvent.click(input);
    await userEvent.type(input, "combustivel");

    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Combustível");
  });

  it("filters options by group name too", async () => {
    renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");

    await userEvent.click(input);
    await userEvent.type(input, "aliment");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByText("Combustível")).not.toBeInTheDocument();
  });

  it("selects an option via direct click and closes the popup", async () => {
    const { onChange } = renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");

    await userEvent.click(input);
    await userEvent.click(screen.getByRole("option", { name: "Restaurante" }));

    expect(onChange).toHaveBeenCalledWith(11);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("navigates with arrow keys and confirms with Enter", async () => {
    const { onChange } = renderCombobox();
    const input = screen.getByLabelText("Categoria de Mercado São João");

    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith(11);
  });

  it("closes without applying on Escape", async () => {
    const { onChange } = renderCombobox({ value: 10 });
    const input = screen.getByLabelText("Categoria de Mercado São João") as HTMLInputElement;

    await userEvent.click(input);
    await userEvent.keyboard("xyz{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input.value).toBe("Alimentação / Supermercado");
  });

  it("exposes the expected ARIA combobox pattern", async () => {
    renderCombobox({ value: 10 });
    const input = screen.getByLabelText("Categoria de Mercado São João");
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(input);

    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input.getAttribute("aria-activedescendant")).toBe(
      `${screen.getByRole("listbox").id}-opt-10`
    );
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("role", "listbox");
    within(listbox)
      .getAllByRole("option")
      .forEach((option) => expect(option).toHaveAttribute("id"));
  });

  it("does not open or accept interaction when disabled", async () => {
    const { onChange } = renderCombobox({ disabled: true });
    const input = screen.getByLabelText("Categoria de Mercado São João");

    expect(input).toBeDisabled();
    await userEvent.click(input);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
