import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InvestimentosPage } from "./InvestimentosPage";

const INVESTIMENTO_FIXTURE = {
  id: 1,
  user_id: 1,
  nome: "Reserva de emergência",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const EVOLUCAO_FIXTURE = {
  saldo_base: "1000.00",
  saldo_atual: "1200.00",
  total_aportes: "150.00",
  total_resgates: "0.00",
  rendimento_estimado: "50.00",
};

const CARTEIRA_FIXTURE = {
  id: 1,
  item_id: 1,
  user_id: 1,
  pluggy_account_id: "acc-1",
  tipo: "investimento",
  nome: "Nubank Investimentos",
  apelido: null,
  numero_mascarado: null,
  saldo: "1200.00",
  moeda: "BRL",
  sync_enabled: true,
  saldo_inicial: "1000.00",
  investimento_id: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const HOLDING_FIXTURE = {
  id: 1,
  item_id: 2,
  user_id: 1,
  pluggy_investment_id: "inv-ext-1",
  tipo: "FIXED_INCOME",
  subtipo: "CDB",
  nome: "CDB - NU FINANCEIRA",
  codigo: null,
  quantidade: "1967409.5229",
  valor_investido: "19674.095229",
  valor_atual: "22762.07",
  saldo_inicial: null,
  moeda: "BRL",
  investimento_id: 1,
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

const HOLDING_TRANSACTION_FIXTURE = {
  id: 1,
  investment_id: 1,
  user_id: 1,
  pluggy_investment_transaction_id: "invtx-ext-1",
  tipo: "SELL",
  descricao: null,
  valor: "1398.87",
  quantidade: "109999.8270035",
  data: "2026-02-22",
  created_at: "2026-02-22T00:00:00Z",
  updated_at: "2026-02-22T00:00:00Z",
};

const TRANSACAO_FIXTURE = {
  id: 1,
  account_id: 2,
  user_id: 1,
  pluggy_transaction_id: "tx-1",
  descricao: "PIX Itaú->Nubank",
  valor: "-150.00",
  tipo: "debito",
  data: "2026-01-10",
  data_competencia: "2026-01-10",
  data_editada_manualmente: false,
  subcategory_id: null,
  categoria_pluggy: null,
  status: "efetivada",
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

// Toda renderização de InvestimentosPage dispara /pluggy/accounts (carteiras
// vinculadas) e /dashboards/por-investimento/tendencia (sparkline) — helper
// cobre essas rotas em todo teste, além de dar uma evolução zerada default
// pra qualquer card renderizado.
function baseHandlers(url: string): Promise<Response> | null {
  if (url.startsWith("/dashboards/por-investimento/tendencia")) {
    return Promise.resolve(jsonResponse([]));
  }
  if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
  if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
  if (url.endsWith("/evolucao")) return Promise.resolve(jsonResponse(EVOLUCAO_FIXTURE));
  return null;
}

describe("InvestimentosPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists investimentos as cards with saldo atual, rendimento estimado and carteiras vinculadas", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([CARTEIRA_FIXTURE]));
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);

    expect(await screen.findByText("Reserva de emergência")).toBeInTheDocument();
    expect(await screen.findByText("R$ 1.200,00")).toBeInTheDocument();
    expect(await screen.findByText(/Rendimento estimado: R\$\s?50,00/)).toBeInTheDocument();
    expect(screen.getByText(/Carteiras: Nubank Investimentos/)).toBeInTheDocument();
  });

  it("creates a new investimento via POST /investimentos", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/investimentos" && method === "POST") {
        return Promise.resolve(jsonResponse({ ...INVESTIMENTO_FIXTURE, nome: "Renda fixa" }, 201));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Nenhum investimento cadastrado.");

    await userEvent.click(screen.getByRole("button", { name: "Novo investimento" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Renda fixa");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/investimentos" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ nome: "Renda fixa" });
    });
  });

  it("edits an existing investimento via PUT /investimentos/{id}", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos" && method === "GET") {
        return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      }
      if (url === "/investimentos/1" && method === "PUT") {
        return Promise.resolve(
          jsonResponse({ ...INVESTIMENTO_FIXTURE, nome: "Reserva atualizada" })
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const nomeInput = screen.getByLabelText("Nome");
    await userEvent.clear(nomeInput);
    await userEvent.type(nomeInput, "Reserva atualizada");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/investimentos/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ nome: "Reserva atualizada" });
    });
  });

  it("deletes an investimento after confirmation via DELETE /investimentos/{id}", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos" && method === "GET") {
        return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      }
      if (url === "/investimentos/1" && method === "DELETE") {
        return Promise.resolve(jsonResponse(null, 204));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/investimentos/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("opens the drilldown outside the card showing the period's total and linked transactions, toggling Aporte/Resgate", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      if (url.startsWith("/dashboards/por-investimento")) {
        const tipo = url.includes("tipo=credito") ? "credito" : "debito";
        const total = tipo === "credito" ? "0.00" : "150.00";
        return Promise.resolve(
          jsonResponse([{ investimento_id: 1, investimento_nome: "Reserva de emergência", total }])
        );
      }
      if (url.startsWith("/pluggy/transactions")) {
        expect(url).toContain("investimento_id=1");
        return Promise.resolve(jsonResponse([TRANSACAO_FIXTURE]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    const grid = screen.getByText("Reserva de emergência").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver extrato no período" }));

    expect(await screen.findByText("R$ 150,00")).toBeInTheDocument();
    expect(screen.getByText("PIX Itaú->Nubank")).toBeInTheDocument();
    const funnel = screen.getByText("PIX Itaú->Nubank").closest(".dash-funnel");
    expect(funnel).not.toBeNull();
    expect(grid.contains(funnel)).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Resgate" }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.includes("/pluggy/transactions") && url.includes("tipo=credito"))
      ).toBe(true);
    });
  });

  it("lists linked posições (holdings) on the card", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([HOLDING_FIXTURE]));
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);

    expect(await screen.findByText("Reserva de emergência")).toBeInTheDocument();
    expect(screen.getByText(/Posições: CDB - NU FINANCEIRA/)).toBeInTheDocument();
  });

  it("opens the drilldown Posições view showing the holding and its expandable transaction history", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([HOLDING_FIXTURE]));
      if (url === "/pluggy/investments/1/transactions") {
        return Promise.resolve(jsonResponse([HOLDING_TRANSACTION_FIXTURE]));
      }
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    const grid = screen.getByText("Reserva de emergência").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver extrato no período" }));
    await userEvent.click(screen.getByRole("button", { name: "Posições" }));

    expect(await screen.findByText("CDB - NU FINANCEIRA")).toBeInTheDocument();
    expect(screen.getByText("FIXED_INCOME / CDB")).toBeInTheDocument();
    expect(screen.getByText("R$ 22.762,07")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ver histórico" }));

    expect(await screen.findByText("SELL")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.398,87")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((c) => String(c[0]) === "/pluggy/investments/1/transactions")
    ).toBe(true);
  });

  it("opens the drilldown Série histórica view rendering the monthly snapshot table", async () => {
    const evolucaoMensalFixture = [
      {
        ano_mes: "2026-01",
        saldo: "5000.00",
        valorizacao: "0.00",
        rendimento: "0.00",
        dividendos: "0.00",
        aportes: "0.00",
        resgates: "0.00",
        confianca: "reconstruido",
      },
      {
        ano_mes: "2026-02",
        saldo: "5500.00",
        valorizacao: "0.00",
        rendimento: "500.00",
        dividendos: "0.00",
        aportes: "0.00",
        resgates: "0.00",
        confianca: "real",
      },
    ];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/investimentos/1/evolucao-mensal") {
        return Promise.resolve(jsonResponse(evolucaoMensalFixture));
      }
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    const grid = screen.getByText("Reserva de emergência").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver extrato no período" }));
    await userEvent.click(screen.getByRole("button", { name: "Série histórica" }));

    expect(await screen.findByText("2026-01")).toBeInTheDocument();
    expect(screen.getByText("2026-02")).toBeInTheDocument();
    expect(screen.getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 5.500,00")).toBeInTheDocument();
    expect(screen.getByText("reconstruido")).toBeInTheDocument();
    expect(screen.getByText("real")).toBeInTheDocument();
    expect(screen.getByText(/Meses marcados "reconstruido"/)).toBeInTheDocument();
  });

  it("shows an empty state for Série histórica when no snapshot exists yet", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/investimentos/1/evolucao-mensal") return Promise.resolve(jsonResponse([]));
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    const grid = screen.getByText("Reserva de emergência").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver extrato no período" }));
    await userEvent.click(screen.getByRole("button", { name: "Série histórica" }));

    expect(await screen.findByText(/Nenhum snapshot mensal ainda/)).toBeInTheDocument();
  });

  it("renders a sparkline on the card when trend data is available", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
      if (url.endsWith("/evolucao")) return Promise.resolve(jsonResponse(EVOLUCAO_FIXTURE));
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      if (url.startsWith("/dashboards/por-investimento/tendencia")) {
        return Promise.resolve(
          jsonResponse([
            {
              investimento_id: 1,
              investimento_nome: "Reserva de emergência",
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

    const { container } = renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    await waitFor(() => {
      expect(container.querySelectorAll(".dash-tile .spark").length).toBeGreaterThan(0);
    });
  });
});
