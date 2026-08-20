import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrcamentoPage } from "./OrcamentoPage";

const GROUPS_FIXTURE = [
  {
    id: 1,
    nome: "Moradia",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const SUBCATEGORIES_FIXTURE = [
  {
    id: 10,
    group_id: 1,
    nome: "Aluguel",
    natureza: "fixa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const ORCAMENTO_EVENTUAL = {
  id: 1,
  subcategory_id: 10,
  tipo: "eventual",
  valor: "1000.00",
  ano: 2026,
  mes: 3,
  data_inicio: null,
  data_fim: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const ORCAMENTO_RECORRENTE = {
  id: 2,
  subcategory_id: 10,
  tipo: "recorrente",
  valor: "500.00",
  ano: null,
  mes: null,
  data_inicio: "2026-01-01",
  data_fim: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function baseHandlers(url: string): Promise<Response> | null {
  if (url === "/category-groups") return Promise.resolve(jsonResponse(GROUPS_FIXTURE));
  if (url === "/subcategories") return Promise.resolve(jsonResponse(SUBCATEGORIES_FIXTURE));
  return null;
}

describe("OrcamentoPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists orçamentos grouped by subcategory", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/orcamentos") {
        return Promise.resolve(jsonResponse([ORCAMENTO_EVENTUAL, ORCAMENTO_RECORRENTE]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OrcamentoPage />);

    expect(await screen.findByText("Moradia / Aluguel")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 500,00")).toBeInTheDocument();
    expect(screen.getByText("3/2026")).toBeInTheDocument();
    expect(screen.getByText("a partir de 2026-01-01")).toBeInTheDocument();
  });

  it("shows empty state when there are no orçamentos", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/orcamentos") return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OrcamentoPage />);

    expect(await screen.findByText("Nenhum orçamento cadastrado.")).toBeInTheDocument();
  });

  it("toggling tipo swaps ano/mes fields for data_inicio/data_fim fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/orcamentos") return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OrcamentoPage />);
    await screen.findByText("Nenhum orçamento cadastrado.");

    await userEvent.click(screen.getByRole("button", { name: "Novo orçamento" }));

    expect(screen.getByLabelText("Ano")).toBeInTheDocument();
    expect(screen.getByLabelText("Mês")).toBeInTheDocument();
    expect(screen.queryByLabelText("Data de início")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Recorrente" }));

    expect(screen.queryByLabelText("Ano")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Data de início")).toBeInTheDocument();
    expect(screen.getByLabelText("Data de fim")).toBeInTheDocument();
  });

  it("creates a new orçamento eventual via POST /orcamentos", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/orcamentos" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/orcamentos" && method === "POST") {
        return Promise.resolve(jsonResponse(ORCAMENTO_EVENTUAL, 201));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OrcamentoPage />);
    await screen.findByText("Nenhum orçamento cadastrado.");

    await userEvent.click(screen.getByRole("button", { name: "Novo orçamento" }));
    await userEvent.click(screen.getByLabelText("Subcategoria do orçamento"));
    await userEvent.click(screen.getByRole("option", { name: "Aluguel" }));
    await userEvent.type(screen.getByLabelText("Valor"), "1000");
    const anoInput = screen.getByLabelText("Ano");
    await userEvent.clear(anoInput);
    await userEvent.type(anoInput, "2026");
    const mesInput = screen.getByLabelText("Mês");
    await userEvent.clear(mesInput);
    await userEvent.type(mesInput, "3");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/orcamentos" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({
        subcategory_id: 10,
        tipo: "eventual",
        valor: "1000",
        ano: 2026,
        mes: 3,
        data_inicio: null,
        data_fim: null,
      });
    });
  });

  it("creates a new orçamento recorrente without data_fim via POST /orcamentos", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/orcamentos" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/orcamentos" && method === "POST") {
        return Promise.resolve(jsonResponse(ORCAMENTO_RECORRENTE, 201));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OrcamentoPage />);
    await screen.findByText("Nenhum orçamento cadastrado.");

    await userEvent.click(screen.getByRole("button", { name: "Novo orçamento" }));
    await userEvent.click(screen.getByLabelText("Subcategoria do orçamento"));
    await userEvent.click(screen.getByRole("option", { name: "Aluguel" }));
    await userEvent.click(screen.getByRole("button", { name: "Recorrente" }));
    await userEvent.type(screen.getByLabelText("Valor"), "500");
    await userEvent.type(screen.getByLabelText("Data de início"), "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/orcamentos" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({
        subcategory_id: 10,
        tipo: "recorrente",
        valor: "500",
        ano: null,
        mes: null,
        data_inicio: "2026-01-01",
        data_fim: null,
      });
    });
  });

  it("deletes an orçamento after confirmation via DELETE /orcamentos/{id}", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/orcamentos" && method === "GET") {
        return Promise.resolve(jsonResponse([ORCAMENTO_EVENTUAL]));
      }
      if (url === "/orcamentos/1" && method === "DELETE") {
        return Promise.resolve(jsonResponse(null, 204));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OrcamentoPage />);
    await screen.findByText("Moradia / Aluguel");

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/orcamentos/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("edits an existing orçamento via PUT /orcamentos/{id}", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/orcamentos" && method === "GET") {
        return Promise.resolve(jsonResponse([ORCAMENTO_EVENTUAL]));
      }
      if (url === "/orcamentos/1" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...ORCAMENTO_EVENTUAL, valor: "2000.00" }));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<OrcamentoPage />);
    await screen.findByText("Moradia / Aluguel");

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const valorInput = screen.getByLabelText("Valor");
    await userEvent.clear(valorInput);
    await userEvent.type(valorInput, "2000");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/orcamentos/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body.valor).toBe("2000");
    });
  });
});
