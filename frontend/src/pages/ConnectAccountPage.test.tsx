import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PluggyConnectOptions, PluggyConnectWidget } from "../pluggy/loadPluggyConnect";
import { ConnectAccountPage } from "./ConnectAccountPage";

const ITEM_FIXTURE = {
  id: 1,
  user_id: 1,
  pluggy_item_id: "item-ext-1",
  connector_id: 1,
  connector_name: "Banco Fake",
  status: "updated",
  status_detail: null,
  cutoff_date: "2026-01-01",
  last_synced_at: null,
  created_at: "2026-08-07T00:00:00Z",
  updated_at: "2026-08-07T00:00:00Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

class FakePluggyConnectWidget implements PluggyConnectWidget {
  private options: PluggyConnectOptions;

  constructor(options: PluggyConnectOptions) {
    this.options = options;
  }

  init() {
    this.options.onSuccess({ item: { id: "item-ext-1" } });
  }
}

describe("ConnectAccountPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { PluggyConnect?: unknown }).PluggyConnect;
  });

  it("connects a bank account and shows it in the connected accounts list", async () => {
    window.PluggyConnect = FakePluggyConnectWidget;

    let itemsCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/pluggy/items" && method === "GET") {
        itemsCallCount += 1;
        return Promise.resolve(jsonResponse(itemsCallCount === 1 ? [] : [ITEM_FIXTURE]));
      }
      if (url === "/pluggy/connect-token" && method === "POST") {
        return Promise.resolve(jsonResponse({ access_token: "connect-token-abc" }));
      }
      if (url === "/pluggy/items" && method === "POST") {
        return Promise.resolve(jsonResponse(ITEM_FIXTURE, 201));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ConnectAccountPage />);

    await screen.findByText("Contas conectadas");

    await userEvent.click(screen.getByRole("button", { name: "Conectar conta bancária" }));

    expect(await screen.findByText(/Banco Fake/)).toBeInTheDocument();
  });
});
