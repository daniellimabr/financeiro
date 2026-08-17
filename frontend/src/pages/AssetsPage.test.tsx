import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetsPage } from "./AssetsPage";

const ASSET_ATIVO = {
  id: 1,
  user_id: 1,
  nome: "Carro",
  tipo: "veiculo",
  valor_atual: "50000.00",
  data_aquisicao: "2024-01-01",
  status: "ativo",
  data_venda: null,
  valor_venda: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const ASSET_BAIXADO = {
  id: 2,
  user_id: 1,
  nome: "Moto antiga",
  tipo: "veiculo",
  valor_atual: "8000.00",
  data_aquisicao: "2020-01-01",
  status: "baixado",
  data_venda: "2026-05-01",
  valor_venda: "7000.00",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const TRANSACAO_FIXTURE = {
  id: 1,
  account_id: 1,
  user_id: 1,
  pluggy_transaction_id: "tx-1",
  descricao: "Posto Ipiranga",
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

// Toda renderização de AssetsPage dispara /dashboards/por-ativo/tendencia (sparkline
// dos cards) mesmo sem nenhum card expandido — helper cobre essa rota em todo teste.
function baseHandlers(url: string): Promise<Response> | null {
  if (url.startsWith("/dashboards/por-ativo/tendencia")) return Promise.resolve(jsonResponse([]));
  return null;
}

describe("AssetsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists active assets in the grid and sold assets in the baixados section", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets") return Promise.resolve(jsonResponse([ASSET_ATIVO, ASSET_BAIXADO]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);

    expect(await screen.findByText("Carro")).toBeInTheDocument();
    expect(screen.getByText("R$ 50.000,00")).toBeInTheDocument();
    expect(screen.getByText("Moto antiga")).toBeInTheDocument();
    expect(screen.getByText("R$ 7.000,00")).toBeInTheDocument();
    expect(screen.getByText("Vendido em 2026-05-01")).toBeInTheDocument();
  });

  it("creates a new asset via POST /assets", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/assets" && method === "POST") {
        return Promise.resolve(jsonResponse({ ...ASSET_ATIVO, nome: "Apartamento" }, 201));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Nenhum ativo cadastrado.");

    await userEvent.click(screen.getByRole("button", { name: "Novo ativo" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Apartamento");
    await userEvent.selectOptions(screen.getByLabelText("Tipo do ativo"), "imovel");
    await userEvent.type(screen.getByLabelText("Valor atual"), "300000");
    const dataInput = screen.getByLabelText("Data de aquisição");
    await userEvent.type(dataInput, "2022-05-10");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/assets" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({
        nome: "Apartamento",
        tipo: "imovel",
        valor_atual: "300000",
        data_aquisicao: "2022-05-10",
      });
    });
  });

  it("edits an existing asset via PUT /assets/{id}", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets" && method === "GET")
        return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url === "/assets/1" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...ASSET_ATIVO, nome: "Carro atualizado" }));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const nomeInput = screen.getByLabelText("Nome");
    await userEvent.clear(nomeInput);
    await userEvent.type(nomeInput, "Carro atualizado");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/assets/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body.nome).toBe("Carro atualizado");
    });
  });

  it("selling an already-sold asset surfaces the backend's idempotency error", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets" && method === "GET")
        return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url === "/assets/1/sell" && method === "POST") {
        return Promise.resolve(jsonResponse({ detail: "Ativo 1 já está baixado" }, 400));
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    await userEvent.click(screen.getByRole("button", { name: "Vender" }));
    const dialog = screen.getByRole("dialog", { name: "Vender Carro" });
    await userEvent.type(within(dialog).getByLabelText("Valor de venda"), "45000");
    const dataVendaInput = within(dialog).getByLabelText("Data de venda");
    await userEvent.clear(dataVendaInput);
    await userEvent.type(dataVendaInput, "2026-08-01");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar venda" }));

    expect(await screen.findByText("Não foi possível registrar a venda.")).toBeInTheDocument();
  });

  it("deletes an asset after confirmation via DELETE /assets/{id}", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets" && method === "GET")
        return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url === "/assets/1" && method === "DELETE")
        return Promise.resolve(jsonResponse(null, 204));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/assets/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("opens the drilldown outside the card showing the period's gasto total and linked transactions", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets") return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url.startsWith("/dashboards/por-ativo")) {
        expect(url).toContain("tipo=debito");
        return Promise.resolve(
          jsonResponse([{ asset_id: 1, asset_nome: "Carro", total: "300.00" }])
        );
      }
      if (url.startsWith("/pluggy/transactions")) {
        expect(url).toContain("asset_id=1");
        expect(url).toContain("tipo=debito");
        return Promise.resolve(jsonResponse([TRANSACAO_FIXTURE]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    const grid = screen.getByText("Carro").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver gasto no período" }));

    expect(await screen.findByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("Posto Ipiranga")).toBeInTheDocument();
    // o funil renderiza fora do card, como painel próprio da página
    const funnel = screen.getByText("Posto Ipiranga").closest(".dash-funnel");
    expect(funnel).not.toBeNull();
    expect(grid.contains(funnel)).toBe(false);
  });

  it("toggling despesa/receita refetches por-ativo and the drilldown with the selected tipo", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets") return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url.startsWith("/dashboards/por-ativo")) {
        const tipo = url.includes("tipo=credito") ? "credito" : "debito";
        const total = tipo === "credito" ? "900.00" : "300.00";
        return Promise.resolve(jsonResponse([{ asset_id: 1, asset_nome: "Carro", total }]));
      }
      if (url.startsWith("/pluggy/transactions")) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    const grid = screen.getByText("Carro").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver gasto no período" }));
    expect(await screen.findByText("R$ 300,00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Receita" }));

    expect(await screen.findByText("R$ 900,00")).toBeInTheDocument();
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.includes("/pluggy/transactions") && url.includes("tipo=credito"))
      ).toBe(true);
    });
  });

  it("toggling Competência/Caixa refetches por-ativo with the selected regime", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets") return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url.startsWith("/dashboards/por-ativo")) {
        const regime = url.includes("regime=caixa") ? "caixa" : "competencia";
        const total = regime === "caixa" ? "999.00" : "300.00";
        return Promise.resolve(jsonResponse([{ asset_id: 1, asset_nome: "Carro", total }]));
      }
      if (url.startsWith("/pluggy/transactions")) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    const grid = screen.getByText("Carro").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver gasto no período" }));
    expect(await screen.findByText("R$ 300,00")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Caixa" }));

    expect(await screen.findByText("R$ 999,00")).toBeInTheDocument();
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.startsWith("/dashboards/por-ativo") && url.includes("regime=caixa"))
      ).toBe(true);
    });
  });

  it("the drilldown table shows an editable Categoria and can be sorted by Data/Valor", async () => {
    const GROUPS = [
      {
        id: 1,
        nome: "Transporte",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const SUBCATEGORIES = [
      {
        id: 20,
        group_id: 1,
        nome: "Combustível",
        natureza: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const TX_A = { ...TRANSACAO_FIXTURE, id: 1, data: "2026-01-10", valor: "-150.00" };
    const TX_B = {
      ...TRANSACAO_FIXTURE,
      id: 2,
      data: "2026-01-20",
      descricao: "Zona Azul",
      valor: "-30.00",
    };

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets") return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url.startsWith("/dashboards/por-ativo")) {
        return Promise.resolve(
          jsonResponse([{ asset_id: 1, asset_nome: "Carro", total: "180.00" }])
        );
      }
      if (url.startsWith("/pluggy/transactions"))
        return Promise.resolve(jsonResponse([TX_A, TX_B]));
      if (url === "/subcategories") return Promise.resolve(jsonResponse(SUBCATEGORIES));
      if (url === "/category-groups") return Promise.resolve(jsonResponse(GROUPS));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    const grid = screen.getByText("Carro").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver gasto no período" }));

    expect(await screen.findByText("Posto Ipiranga")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria de Posto Ipiranga")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria de Zona Azul")).toBeInTheDocument();

    const table = screen.getByText("Posto Ipiranga").closest("table") as HTMLElement;
    const rowsInOrder = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent);

    // ordem inicial: data desc (default do TransactionsTable) — Zona Azul (20) antes de Posto Ipiranga (10)
    expect(rowsInOrder()[0]).toContain("Zona Azul");

    await userEvent.click(within(table).getByRole("button", { name: /Valor/ }));
    expect(rowsInOrder()[0]).toContain("Posto Ipiranga"); // -150 é o menor valor (asc)

    await userEvent.click(within(table).getByRole("button", { name: /Valor/ }));
    expect(rowsInOrder()[0]).toContain("Zona Azul"); // -30 é o maior valor (desc)
  });

  it("the drilldown table can be sorted by Categoria", async () => {
    const GROUPS = [
      {
        id: 1,
        nome: "Alimentação",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 2,
        nome: "Transporte",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const SUBCATEGORIES = [
      {
        id: 10,
        group_id: 1,
        nome: "Mercado",
        natureza: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 20,
        group_id: 2,
        nome: "Combustível",
        natureza: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const TX_A = {
      ...TRANSACAO_FIXTURE,
      id: 1,
      descricao: "Posto Ipiranga",
      subcategory_id: 20,
    };
    const TX_B = {
      ...TRANSACAO_FIXTURE,
      id: 2,
      descricao: "Zona Azul",
      subcategory_id: 10,
    };

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/assets") return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url.startsWith("/dashboards/por-ativo")) {
        return Promise.resolve(
          jsonResponse([{ asset_id: 1, asset_nome: "Carro", total: "180.00" }])
        );
      }
      if (url.startsWith("/pluggy/transactions"))
        return Promise.resolve(jsonResponse([TX_A, TX_B]));
      if (url === "/subcategories") return Promise.resolve(jsonResponse(SUBCATEGORIES));
      if (url === "/category-groups") return Promise.resolve(jsonResponse(GROUPS));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    const grid = screen.getByText("Carro").closest(".dash-tile") as HTMLElement;
    await userEvent.click(within(grid).getByRole("button", { name: "Ver gasto no período" }));
    await screen.findByText("Posto Ipiranga");

    const table = screen.getByText("Posto Ipiranga").closest("table") as HTMLElement;
    const rowsInOrder = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent);

    await userEvent.click(within(table).getByRole("button", { name: "Categoria" }));
    // "Alimentação / Mercado" (Zona Azul) vem antes de "Transporte / Combustível" (Posto Ipiranga) — asc
    expect(rowsInOrder()[0]).toContain("Zona Azul");

    await userEvent.click(within(table).getByRole("button", { name: "Categoria" }));
    expect(rowsInOrder()[0]).toContain("Posto Ipiranga"); // desc
  });

  it("renders a sparkline on the card when trend data is available", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/assets") return Promise.resolve(jsonResponse([ASSET_ATIVO]));
      if (url.startsWith("/dashboards/por-ativo/tendencia")) {
        return Promise.resolve(
          jsonResponse([
            {
              asset_id: 1,
              asset_nome: "Carro",
              pontos: [
                { ano: 2025, mes: 12, total: "100.00" },
                { ano: 2026, mes: 1, total: "300.00" },
              ],
            },
          ])
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderWithQueryClient(<AssetsPage />);
    await screen.findByText("Carro");

    await waitFor(() => {
      expect(container.querySelectorAll(".dash-tile .spark").length).toBeGreaterThan(0);
    });
  });
});
