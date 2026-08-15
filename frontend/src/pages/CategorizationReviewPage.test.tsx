import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CategorizedTransaction } from "../api/categorization";
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

const BASE_TRANSACTION: CategorizedTransaction = {
  id: 1,
  account_id: 1,
  user_id: 1,
  descricao: "Mercado Sao Joao",
  descricao_usuario: null,
  descricao_sugerida: null,
  descricao_sugestao_origem_id: null,
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
  liability_id: null,
  liability_sugerido_id: null,
  liability_sugestao_confianca: null,
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

function transactionsPage(items: CategorizedTransaction[], total = items.length) {
  return { items, total, page: 1, page_size: 20 };
}

function baseHandlers(url: string): Promise<Response> | null {
  if (url === "/category-groups") return Promise.resolve(jsonResponse([GROUP_FIXTURE]));
  if (url === "/subcategories") return Promise.resolve(jsonResponse([SUBCATEGORY_FIXTURE]));
  if (url === "/assets") return Promise.resolve(jsonResponse([]));
  return null;
}

describe("CategorizationReviewPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the pending transaction with the suggested category pre-selected", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);

    expect(await screen.findByText("Mercado Sao Joao")).toBeInTheDocument();
    const input = (await screen.findByLabelText(
      "Categoria de Mercado Sao Joao"
    )) as HTMLInputElement;
    expect(input.value).toBe("Alimentação / Supermercado");
  });

  it("shows a status badge for pending and confirmed rows", async () => {
    const confirmedTransaction: CategorizedTransaction = {
      ...BASE_TRANSACTION,
      id: 2,
      descricao: "Restaurante Bom Sabor",
      categorizacao_status: "confirmada",
      subcategory_id: 10,
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(
          jsonResponse(transactionsPage([BASE_TRANSACTION, confirmedTransaction]))
        );
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    expect(document.querySelector(".status-badge--pending")).toHaveTextContent("Pendente");
    expect(document.querySelector(".status-badge--confirmed")).toHaveTextContent("Confirmada");
  });

  it("choosing a category on a pending row buffers locally instead of saving immediately", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/category-groups")) return Promise.resolve(jsonResponse([GROUP_FIXTURE]));
      if (url.startsWith("/subcategories"))
        return Promise.resolve(
          jsonResponse([
            SUBCATEGORY_FIXTURE,
            { ...SUBCATEGORY_FIXTURE, id: 11, nome: "Restaurante" },
          ])
        );
      if (url.startsWith("/assets")) return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/categorization/transactions") && method === "GET")
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    await userEvent.click(screen.getByLabelText("Categoria de Mercado Sao Joao"));
    await userEvent.click(screen.getByRole("option", { name: "Restaurante" }));

    const putCall = fetchMock.mock.calls.find(
      (c) =>
        String(c[0]) === "/categorization/transactions/1/category" &&
        (c[1] as RequestInit)?.method === "PUT"
    );
    expect(putCall).toBeUndefined();

    const input = screen.getByLabelText("Categoria de Mercado Sao Joao") as HTMLInputElement;
    expect(input.value).toBe("Alimentação / Restaurante");
  });

  it("defaults to status=pendente in the request", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    const calls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calls.some((url) => url.includes("status=pendente"))).toBe(true);
  });

  it("confirming a row calls the API and removes it from the list after refetch", async () => {
    let callCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;

      if (url.startsWith("/categorization/transactions") && method === "GET") {
        callCount += 1;
        return Promise.resolve(
          jsonResponse(
            callCount === 1 ? transactionsPage([BASE_TRANSACTION]) : transactionsPage([])
          )
        );
      }
      if (url === "/categorization/transactions/1/category" && method === "PUT") {
        return Promise.resolve(
          jsonResponse({ ...BASE_TRANSACTION, categorizacao_status: "confirmada" })
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);

    await screen.findByText("Mercado Sao Joao");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Nenhuma transação encontrada.")).toBeInTheDocument();
  });

  it("refetches with the mes filter when the select changes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Janeiro");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.startsWith("/categorization/transactions") && url.includes("mes=1"))
      ).toBe(true);
    });
  });

  it("advances to the next page and requests page=2", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION], 25)));
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
        calls.some(
          (url) => url.startsWith("/categorization/transactions") && url.includes("page=2")
        )
      ).toBe(true);
    });
  });

  it("marking a row and approving marked rows calls bulk-confirm", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;

      if (url.startsWith("/categorization/transactions") && method === "GET")
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      if (url === "/categorization/transactions/bulk-confirm" && method === "POST") {
        return Promise.resolve(
          jsonResponse({ results: [{ transaction_id: 1, success: true, error: null }] })
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    await userEvent.click(screen.getByLabelText("Marcar Mercado Sao Joao"));
    await userEvent.click(screen.getByRole("button", { name: /Aprovar marcadas/ }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/categorization/transactions/bulk-confirm" &&
          (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ items: [{ transaction_id: 1, subcategory_id: 10 }] });
    });
  });

  it("editing the description calls the description endpoint", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;

      if (url.startsWith("/categorization/transactions") && method === "GET")
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      if (url === "/categorization/transactions/1/description" && method === "PUT") {
        return Promise.resolve(
          jsonResponse({
            transaction: { ...BASE_TRANSACTION, descricao_usuario: "Mercado do bairro" },
            propagated: 0,
          })
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    await userEvent.click(screen.getByText("Mercado Sao Joao"));
    const input = screen.getByLabelText("Editar descrição de Mercado Sao Joao");
    await userEvent.clear(input);
    await userEvent.type(input, "Mercado do bairro{Enter}");

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/categorization/transactions/1/description" &&
          (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ descricao: "Mercado do bairro" });
    });
  });

  it("refetches with has_asset=true when the 'associado a ativo' filter is set to Sim", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    await userEvent.selectOptions(screen.getByLabelText("Associado a ativo"), "Sim");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some(
          (url) => url.startsWith("/categorization/transactions") && url.includes("has_asset=true")
        )
      ).toBe(true);
    });
  });

  it("refetches with group_id when the categoria (grupo) filter changes", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    await userEvent.selectOptions(screen.getByLabelText("Categoria"), "Alimentação");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some(
          (url) => url.startsWith("/categorization/transactions") && url.includes("group_id=1")
        )
      ).toBe(true);
    });
  });

  it("renders a débito/crédito direction icon next to the value", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url.startsWith("/categorization/transactions"))
        return Promise.resolve(jsonResponse(transactionsPage([BASE_TRANSACTION])));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");

    const valorCell = document.querySelector(".dash-table tbody .valor-cell");
    expect(valorCell).not.toBeNull();
    expect(valorCell?.querySelector(".transaction-tipo-icon.despesa")).not.toBeNull();
  });

  it("accepting a pending description suggestion calls the confirm endpoint", async () => {
    const withSuggestion = { ...BASE_TRANSACTION, descricao_sugerida: "Mercado do bairro" };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;

      if (url.startsWith("/categorization/transactions") && method === "GET")
        return Promise.resolve(jsonResponse(transactionsPage([withSuggestion])));
      if (url === "/categorization/transactions/1/description/confirm" && method === "POST") {
        return Promise.resolve(jsonResponse({ ...withSuggestion, descricao_sugerida: null }));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<CategorizationReviewPage />);
    await screen.findByText("Mercado Sao Joao");
    expect(await screen.findByText(/Sugestão: Mercado do bairro/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Aceitar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/categorization/transactions/1/description/confirm" &&
          (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});
