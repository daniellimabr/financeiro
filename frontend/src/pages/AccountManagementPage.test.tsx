import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
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

    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar sincronização" }, { container: dialog })
    );

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
});
