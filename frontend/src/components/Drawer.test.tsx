import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Drawer } from "./Drawer";

describe("Drawer", () => {
  it("does not render children when closed", () => {
    const childRender = vi.fn(() => <p>Conteúdo</p>);
    render(
      <Drawer open={false} onClose={vi.fn()} title="Categorias">
        {childRender()}
      </Drawer>
    );

    expect(childRender).toHaveBeenCalled();
    expect(screen.queryByText("Conteúdo")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders children and a dialog with the given title when open", () => {
    render(
      <Drawer open onClose={vi.fn()} title="Categorias">
        <p>Conteúdo</p>
      </Drawer>
    );

    expect(screen.getByRole("dialog", { name: "Categorias" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Categorias" })).toBeInTheDocument();
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
  });

  it("focuses the close button on open", () => {
    render(
      <Drawer open onClose={vi.fn()} title="Categorias">
        <p>Conteúdo</p>
      </Drawer>
    );

    expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open onClose={onClose} title="Categorias">
        <p>Conteúdo</p>
      </Drawer>
    );

    const backdrop = container.ownerDocument.querySelector(".ac-drawer-backdrop");
    expect(backdrop).not.toBeNull();
    await userEvent.click(backdrop as Element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Categorias">
        <p>Conteúdo</p>
      </Drawer>
    );

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Categorias">
        <p>Conteúdo</p>
      </Drawer>
    );

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the panel", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Categorias">
        <p>Conteúdo</p>
      </Drawer>
    );

    await userEvent.click(screen.getByText("Conteúdo"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
