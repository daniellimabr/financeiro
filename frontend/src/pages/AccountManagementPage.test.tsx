import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PluggyConnectOptions, PluggyConnectWidget } from "../pluggy/loadPluggyConnect";
import { AccountManagementPage } from "./AccountManagementPage";

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

const ACCOUNT_FIXTURE = {
  id: 1,
  item_id: 1,
  user_id: 1,
  pluggy_account_id: "acc-ext-1",
  tipo: "corrente",
  nome: "Conta Corrente",
  apelido: null,
  numero_mascarado: "1234",
  saldo: "100.50",
  moeda: "BRL",
  sync_enabled: true,
  saldo_inicial: null,
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

describe("AccountManagementPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { PluggyConnect?: unknown }).PluggyConnect;
  });

  it("renders connected accounts with apelido fallback, tipo label and formatted balance", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([ACCOUNT_FIXTURE]));
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);

    expect(await screen.findByText(/Conta Corrente/)).toBeInTheDocument();
    expect(screen.getByText(/Banco Fake/)).toBeInTheDocument();
    expect(screen.getByText(/Conta corrente/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?100,50/)).toBeInTheDocument();
  });

  it("editing the apelido saves it via PUT /pluggy/accounts/{id}", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/accounts" && method === "GET")
        return Promise.resolve(jsonResponse([ACCOUNT_FIXTURE]));
      if (url === "/pluggy/accounts/1" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...ACCOUNT_FIXTURE, apelido: "Conta principal" }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);

    await userEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    const input = screen.getByLabelText("Apelido de Conta Corrente");
    await userEvent.clear(input);
    await userEvent.type(input, "Conta principal");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/accounts/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ apelido: "Conta principal", sync_enabled: true });
    });
  });

  it("toggling sync removes the account from sync via PUT with sync_enabled false", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/accounts" && method === "GET")
        return Promise.resolve(jsonResponse([ACCOUNT_FIXTURE]));
      if (url === "/pluggy/accounts/1" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...ACCOUNT_FIXTURE, sync_enabled: false }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);

    await userEvent.click(screen.getByRole("button", { name: "Remover da sincronização" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/accounts/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ apelido: null, sync_enabled: false });
    });
  });

  it("opens the unified sync dialog pre-selected from sync_enabled and confirms with the matching item_ids", async () => {
    const disabledAccount = { ...ACCOUNT_FIXTURE, id: 2, sync_enabled: false, nome: "Poupança" };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/accounts" && method === "GET")
        return Promise.resolve(jsonResponse([ACCOUNT_FIXTURE, disabledAccount]));
      if (url === "/pluggy/sync" && method === "POST") {
        return Promise.resolve(jsonResponse({ results: [] }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);

    await userEvent.click(screen.getByRole("button", { name: "Sincronizar MeuPluggy" }));

    const dialog = screen.getByRole("dialog", { name: "Sincronizar MeuPluggy" });
    const checkboxes = screen.getAllByRole("checkbox");
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);

    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar sincronização" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/sync" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ item_ids: [1] });
    });
  });

  it("connects a bank account via the Pluggy widget", async () => {
    window.PluggyConnect = FakePluggyConnectWidget;

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts" && method === "GET") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/connect-token" && method === "POST") {
        return Promise.resolve(jsonResponse({ access_token: "connect-token-abc" }));
      }
      if (url === "/pluggy/items" && method === "POST") {
        return Promise.resolve(jsonResponse(ITEM_FIXTURE, 201));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText("Nenhuma conta conectada.");

    await userEvent.click(screen.getByRole("button", { name: "Conectar conta bancária" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/items" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("editing the saldo inicial saves it via PUT /pluggy/accounts/{id}/saldo-inicial", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/accounts" && method === "GET")
        return Promise.resolve(jsonResponse([ACCOUNT_FIXTURE]));
      if (url === "/pluggy/accounts/1/saldo-inicial" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...ACCOUNT_FIXTURE, saldo_inicial: "1500.00" }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);
    expect(screen.getByText(/não informado/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    const input = screen.getByLabelText("Saldo inicial de Conta Corrente");
    await userEvent.type(input, "1500");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/pluggy/accounts/1/saldo-inicial" &&
          (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ saldo_inicial: "1500" });
    });
  });

  it("renders the monthly audit table from evolucao-saldo-por-conta data", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/accounts")
        return Promise.resolve(jsonResponse([{ ...ACCOUNT_FIXTURE, saldo_inicial: "1000.00" }]));
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta")) {
        return Promise.resolve(
          jsonResponse([
            {
              account_id: 1,
              account_nome: "Conta Corrente",
              account_tipo: "corrente",
              saldo_inicial: "1000.00",
              pontos: [
                { ano: 2026, mes: 1, total: "1500.00" },
                { ano: 2026, mes: 2, total: "1300.00" },
              ],
            },
          ])
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);

    expect(await screen.findByText("01/2026")).toBeInTheDocument();
    expect(screen.getByText("02/2026")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.300,00")).toBeInTheDocument();
    expect(screen.getAllByText(/Conta Corrente/)).toHaveLength(2);
  });
});
