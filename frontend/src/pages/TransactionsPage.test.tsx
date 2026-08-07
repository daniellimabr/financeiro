import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransactionsPage } from "./TransactionsPage";

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

const TRANSACTION_FIXTURE = {
  id: 1,
  account_id: 1,
  user_id: 1,
  pluggy_transaction_id: "tx-ext-1",
  descricao: "Mercado",
  valor: "-50.25",
  tipo: "debito",
  data: "2026-01-15",
  data_competencia: null,
  subcategory_id: null,
  categoria_pluggy: "Alimentação",
  status: "efetivada",
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

describe("TransactionsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists synced transactions", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/transactions")
        return Promise.resolve(jsonResponse([TRANSACTION_FIXTURE]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<TransactionsPage />);

    expect(await screen.findByText("Mercado")).toBeInTheDocument();
  });

  it("syncs an account when the sync button is clicked", async () => {
    let transactionsCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url === "/pluggy/items" && method === "GET") {
        return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      }
      if (url === "/pluggy/transactions" && method === "GET") {
        transactionsCallCount += 1;
        return Promise.resolve(
          jsonResponse(transactionsCallCount === 1 ? [] : [TRANSACTION_FIXTURE])
        );
      }
      if (url === "/pluggy/items/1/sync" && method === "POST") {
        return Promise.resolve(
          jsonResponse({ ...ITEM_FIXTURE, last_synced_at: "2026-08-07T00:00:00Z" })
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<TransactionsPage />);

    await screen.findByRole("button", { name: "Sincronizar Banco Fake" });
    await userEvent.click(screen.getByRole("button", { name: "Sincronizar Banco Fake" }));

    expect(await screen.findByText("Mercado")).toBeInTheDocument();
  });
});
