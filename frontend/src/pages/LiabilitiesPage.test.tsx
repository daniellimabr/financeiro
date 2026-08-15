import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiabilitiesPage } from "./LiabilitiesPage";

const LIABILITY_ATIVO = {
  id: 1,
  user_id: 1,
  nome: "Financiamento carro",
  tipo: "financiamento",
  valor_total: "60000.00",
  saldo_devedor: "30000.00",
  status: "ativo",
  data_quitacao: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const LIABILITY_QUITADO = {
  id: 2,
  user_id: 1,
  nome: "Empréstimo antigo",
  tipo: "outro",
  valor_total: "5000.00",
  saldo_devedor: "0.00",
  status: "quitado",
  data_quitacao: "2026-05-01",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const TRANSACAO_FIXTURE = {
  id: 1,
  account_id: 1,
  user_id: 1,
  pluggy_transaction_id: "tx-1",
  descricao: "Parcela financiamento",
  descricao_usuario: null,
  descricao_sugerida: null,
  valor: "-1200.00",
  tipo: "debito",
  data: "2026-01-10",
  data_competencia: "2026-01-10",
  subcategory_id: null,
  subcategoria_sugerida_id: null,
  categoria_pluggy: null,
  status: "efetivada",
  account_tipo: "corrente",
  asset_id: null,
  asset_sugerido_id: null,
  created_at: "2026-01-10T00:00:00Z",
  updated_at: "2026-01-10T00:00:00Z",
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

// Toda renderização de LiabilitiesPage dispara /dashboards/por-passivo/tendencia
// (sparkline dos cards) mesmo sem nenhum card expandido — helper cobre essa
// rota em todo teste, mesmo padrão de AssetsPage.test.tsx.
function baseHandlers(url: string): Promise<Response> | null {
  if (url.startsWith("/dashboards/por-passivo/tendencia")) return Promise.resolve(jsonResponse([]));
  return null;
}

describe("LiabilitiesPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists active liabilities in the grid and settled ones in the quitados section", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/liabilities") {
        return Promise.resolve(jsonResponse([LIABILITY_ATIVO, LIABILITY_QUITADO]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<LiabilitiesPage />);

    expect(await screen.findByText("Financiamento carro")).toBeInTheDocument();
    expect(screen.getByText("R$ 30.000,00")).toBeInTheDocument();
    expect(screen.getByText("Empréstimo antigo")).toBeInTheDocument();
    expect(screen.getByText("Quitado em 2026-05-01")).toBeInTheDocument();
  });

  it("creates a new liability via POST /liabilities", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/liabilities" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/liabilities" && method === "POST") {
        return Promise.resolve(
          jsonResponse({ ...LIABILITY_ATIVO, nome: "Financiamento casa" }, 201)
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<LiabilitiesPage />);
    await screen.findByText("Nenhum passivo cadastrado.");

    await userEvent.click(screen.getByRole("button", { name: "Novo passivo" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Financiamento casa");
    await userEvent.selectOptions(screen.getByLabelText("Tipo do passivo"), "financiamento");
    await userEvent.type(screen.getByLabelText("Valor total"), "300000");
    await userEvent.type(screen.getByLabelText("Saldo devedor"), "280000");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/liabilities" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({
        nome: "Financiamento casa",
        tipo: "financiamento",
        valor_total: "300000",
        saldo_devedor: "280000",
      });
    });
  });

  it("edits an existing liability via PUT /liabilities/{id}", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/liabilities" && method === "GET")
        return Promise.resolve(jsonResponse([LIABILITY_ATIVO]));
      if (url === "/liabilities/1" && method === "PUT") {
        return Promise.resolve(
          jsonResponse({ ...LIABILITY_ATIVO, nome: "Financiamento atualizado" })
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<LiabilitiesPage />);
    await screen.findByText("Financiamento carro");

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const nomeInput = screen.getByLabelText("Nome");
    await userEvent.clear(nomeInput);
    await userEvent.type(nomeInput, "Financiamento atualizado");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/liabilities/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body.nome).toBe("Financiamento atualizado");
    });
  });

  it("settling an already-settled liability surfaces the backend's idempotency error", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/liabilities" && method === "GET")
        return Promise.resolve(jsonResponse([LIABILITY_ATIVO]));
      if (url === "/liabilities/1/settle" && method === "POST") {
        return Promise.resolve(jsonResponse({ detail: "Passivo 1 já está quitado" }, 400));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<LiabilitiesPage />);
    await screen.findByText("Financiamento carro");

    await userEvent.click(screen.getByRole("button", { name: "Quitar" }));

    expect(await screen.findByText("Não foi possível quitar o passivo.")).toBeInTheDocument();
  });

  it("deletes a liability after confirmation via DELETE /liabilities/{id}", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/liabilities" && method === "GET")
        return Promise.resolve(jsonResponse([LIABILITY_ATIVO]));
      if (url === "/liabilities/1" && method === "DELETE")
        return Promise.resolve(jsonResponse(null, 204));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<LiabilitiesPage />);
    await screen.findByText("Financiamento carro");

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/liabilities/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("opens the drilldown outside the card showing the period's gasto total and linked transactions, editable inline", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/liabilities") return Promise.resolve(jsonResponse([LIABILITY_ATIVO]));
      if (url.startsWith("/dashboards/por-passivo")) {
        return Promise.resolve(
          jsonResponse([
            { liability_id: 1, liability_nome: "Financiamento carro", total: "1200.00" },
          ])
        );
      }
      if (url.startsWith("/pluggy/transactions")) {
        expect(url).toContain("liability_id=1");
        expect(url).toContain("tipo=debito");
        return Promise.resolve(jsonResponse([TRANSACAO_FIXTURE]));
      }
      if (url.startsWith("/subcategories")) return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/category-groups")) return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/assets")) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<LiabilitiesPage />);
    await screen.findByText("Financiamento carro");

    const grid = screen.getByText("Financiamento carro").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver gasto no período" }));

    expect(await screen.findByText("R$ 1.200,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parcela financiamento" })).toBeInTheDocument();
    // o funil renderiza fora do card, como painel próprio da página
    const funnel = screen
      .getByRole("button", { name: "Parcela financiamento" })
      .closest(".dash-funnel");
    expect(funnel).not.toBeNull();
    expect(grid.contains(funnel)).toBe(false);
  });

  it("renders a sparkline on the card when trend data is available", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/liabilities") return Promise.resolve(jsonResponse([LIABILITY_ATIVO]));
      if (url.startsWith("/dashboards/por-passivo/tendencia")) {
        return Promise.resolve(
          jsonResponse([
            {
              liability_id: 1,
              liability_nome: "Financiamento carro",
              pontos: [
                { ano: 2025, mes: 12, total: "1000.00" },
                { ano: 2026, mes: 1, total: "1200.00" },
              ],
            },
          ])
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderWithQueryClient(<LiabilitiesPage />);
    await screen.findByText("Financiamento carro");

    await waitFor(() => {
      expect(container.querySelectorAll(".dash-tile .spark").length).toBeGreaterThan(0);
    });
  });
});
