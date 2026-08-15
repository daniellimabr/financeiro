import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardSparkline } from "./CardSparkline";

describe("CardSparkline", () => {
  it("renders nothing when there are fewer than two values", () => {
    const { container: empty } = render(<CardSparkline values={undefined} color="red" />);
    expect(empty.querySelector(".spark")).not.toBeInTheDocument();

    const { container: single } = render(<CardSparkline values={[10]} color="red" />);
    expect(single.querySelector(".spark")).not.toBeInTheDocument();
  });

  it("renders a spark span when there are two or more values", () => {
    const { container } = render(<CardSparkline values={[10, 20, 15]} color="red" />);
    expect(container.querySelector(".spark")).toBeInTheDocument();
  });
});
