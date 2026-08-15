import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategorizationReviewPage } from "./CategorizationReviewPage";

const GROUP_FIXTURE = {
  id: 1,
  nome: "Alimentação",
  created_at: "2026-08-14T00:00:00Z",
  updated_at: "2026-08-14T00:00:00Z",
};

const SUBCATEGORY_FIXTURE = {
  id: 10,
  group_id: 1,
  nome: "Supermercado",
  natureza: "variavel",
  created_at: "2026-08-14T00:00:00Z",
  updated_at: "2026-08-14T00:00:00Z",
};

const PENDING_TRANSACTION_FIXTURE = {
  id: 1,
  account_id: 1,
  user_id: 1,
  descricao: "Mercado Sao Joao",
  valor: "-50.25",
  tipo: "debito",
  data: "2026-01-15",
  status: "efetivada",
  categorizacao_status: "pendente",
  subcategory_id: null,
  subcategoria_sugerida_id: 10,
  sugestao_confianca: "alta",
  sugestao_fonte_tipo: "regra",
  sugestao_score: null,
  asset_id: null,
  asset_sugerido_id: null,
  asset_sugestao_confianca: null,
  created_at: "2026-08-14T00:00:00Z",
  updated_at: "2026-08-14T00:00:00Z",
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

describe("CategorizationReviewPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function pendingPage(items: (typeof PENDING_TRANSACTION_FIXTURE)[], total = items.length) {
    return { items, total, page: 1, page_size: 20 };
  }

  it("renders the pending transaction with the suggested category pre-selected", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/categorization/pending"))
        return Promise.resolve(jsonResponse(pendingPage([PENDING_TRANSACTION_FIXTURE])));
      if (url === "/category-groups") return Promise.resolve(jsonResponse([GROUP_FIXTURE]));
      if (url === "/subcategories") return Promise.resolve(jsonResponse([SUBCATEGORY_FIXTURE]));
      if (url === "/assets") return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);

    expect(await screen.findByText("Mercado Sao Joao")).toBeInTheDocument();
    const select = (await screen.findByLabelText(
      "Categoria de Mercado Sao Joao"
    )) as HTMLSelectElement;
    expect(select.value).toBe("10");
  });

  it("confirming a row calls the API and removes it from the list after refetch", async () => {
    let pendingCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.startsWith("/categorization/pending") && method === "GET") {
        pendingCallCount += 1;
        return Promise.resolve(
          jsonResponse(
            pendingCallCount === 1 ? pendingPage([PENDING_TRANSACTION_FIXTURE]) : pendingPage([])
          )
        );
      }
      if (url === "/category-groups") return Promise.resolve(jsonResponse([GROUP_FIXTURE]));
      if (url === "/subcategories") return Promise.resolve(jsonResponse([SUBCATEGORY_FIXTURE]));
      if (url === "/assets") return Promise.resolve(jsonResponse([]));
      if (url === "/categorization/pending/1/confirm" && method === "POST") {
        return Promise.resolve(
          jsonResponse({ ...PENDING_TRANSACTION_FIXTURE, categorizacao_status: "confirmada" })
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);

    await screen.findByText("Mercado Sao Joao");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Nenhuma transação pendente.")).toBeInTheDocument();
  });

  it("refetches with the ano/mes filter when the selects change", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/categorization/pending"))
        return Promise.resolve(jsonResponse(pendingPage([PENDING_TRANSACTION_FIXTURE])));
      if (url === "/category-groups") return Promise.resolve(jsonResponse([GROUP_FIXTURE]));
      if (url === "/subcategories") return Promise.resolve(jsonResponse([SUBCATEGORY_FIXTURE]));
      if (url === "/assets") return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Janeiro");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.startsWith("/categorization/pending") && url.includes("mes=1"))
      ).toBe(true);
    });
  });

  it("advances to the next page and requests page=2", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/categorization/pending"))
        return Promise.resolve(jsonResponse(pendingPage([PENDING_TRANSACTION_FIXTURE], 25)));
      if (url === "/category-groups") return Promise.resolve(jsonResponse([GROUP_FIXTURE]));
      if (url === "/subcategories") return Promise.resolve(jsonResponse([SUBCATEGORY_FIXTURE]));
      if (url === "/assets") return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");
    expect(await screen.findByText(/Página 1 de 2/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Próxima →" }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.startsWith("/categorization/pending") && url.includes("page=2"))
      ).toBe(true);
    });
  });
});
