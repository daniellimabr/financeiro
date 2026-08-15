import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PeriodFilter } from "./PeriodFilter";

describe("PeriodFilter", () => {
  it("calls onChange with the new mes when the month select changes", async () => {
    const onChange = vi.fn();
    render(<PeriodFilter ano={2026} mes={8} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Janeiro");

    expect(onChange).toHaveBeenCalledWith({ mes: 1 });
  });

  it("calls onChange with the new ano when the year select changes", async () => {
    const onChange = vi.fn();
    render(<PeriodFilter ano={2026} mes={8} onChange={onChange} />);

    await userEvent.selectOptions(screen.getByLabelText("Ano"), "2025");

    expect(onChange).toHaveBeenCalledWith({ ano: 2025 });
  });

  it("renders ano-1, ano and ano+1 as year options", () => {
    render(<PeriodFilter ano={2026} mes={8} onChange={vi.fn()} />);

    const anoSelect = screen.getByLabelText("Ano") as HTMLSelectElement;
    const options = Array.from(anoSelect.options).map((option) => option.value);
    expect(options).toEqual(["2025", "2026", "2027"]);
  });
});
