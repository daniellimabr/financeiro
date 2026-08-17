import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegimeToggle } from "./RegimeToggle";

describe("RegimeToggle", () => {
  it("marks Competência as pressed by default", () => {
    render(<RegimeToggle value="competencia" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Competência" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Caixa" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks Caixa as pressed when value is caixa", () => {
    render(<RegimeToggle value="caixa" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Caixa" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Competência" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("calls onChange with caixa when the Caixa button is clicked", async () => {
    const onChange = vi.fn();
    render(<RegimeToggle value="competencia" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Caixa" }));

    expect(onChange).toHaveBeenCalledWith("caixa");
  });

  it("calls onChange with competencia when the Competência button is clicked", async () => {
    const onChange = vi.fn();
    render(<RegimeToggle value="caixa" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Competência" }));

    expect(onChange).toHaveBeenCalledWith("competencia");
  });
});
