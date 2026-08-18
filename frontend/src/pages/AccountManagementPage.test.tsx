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

const INVESTMENT_FIXTURE = {
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
  investimento_id: null,
  investimento_sugerido_id: null,
  investimento_sugestao_confianca: null,
  investimento_sugestao_fonte_tipo: null,
  investimento_sugestao_fonte_id: null,
  investimento_sugestao_score: null,
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
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
  investimento_id: null,
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
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
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
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
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
      expect(body).toEqual({
        apelido: "Conta principal",
        sync_enabled: true,
        investimento_id: null,
      });
    });
  });

  it("toggling sync removes the account from sync via PUT with sync_enabled false", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
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
      expect(body).toEqual({ apelido: null, sync_enabled: false, investimento_id: null });
    });
  });

  it("disables the delete button while the account is still sync_enabled", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([ACCOUNT_FIXTURE]));
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);

    expect(screen.getByRole("button", { name: "Excluir conta" })).toBeDisabled();
  });

  it("enables the delete button and calls DELETE once the account is out of sync", async () => {
    const disabledAccount = { ...ACCOUNT_FIXTURE, sync_enabled: false };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts" && method === "GET")
        return Promise.resolve(jsonResponse([disabledAccount]));
      if (url === "/pluggy/accounts/1" && method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);

    const deleteButton = screen.getByRole("button", { name: "Excluir conta" });
    expect(deleteButton).toBeEnabled();
    await userEvent.click(deleteButton);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/accounts/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("does not call DELETE when the confirmation dialog is dismissed", async () => {
    const disabledAccount = { ...ACCOUNT_FIXTURE, sync_enabled: false };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts" && method === "GET")
        return Promise.resolve(jsonResponse([disabledAccount]));
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Conta Corrente/);

    await userEvent.click(screen.getByRole("button", { name: "Excluir conta" }));

    expect(
      fetchMock.mock.calls.some(
        (c) => String(c[0]) === "/pluggy/accounts/1" && (c[1] as RequestInit)?.method === "DELETE"
      )
    ).toBe(false);
  });

  it("opens the unified sync dialog pre-selected from sync_enabled and confirms with the matching item_ids", async () => {
    const disabledAccount = { ...ACCOUNT_FIXTURE, id: 2, sync_enabled: false, nome: "Poupança" };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
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
      if (url === "/pluggy/investments" && method === "GET")
        return Promise.resolve(jsonResponse([]));
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
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
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

  it("linking a carteira to an investimento saves it via PUT /pluggy/accounts/{id}", async () => {
    const investmentAccount = {
      ...ACCOUNT_FIXTURE,
      id: 2,
      tipo: "investimento",
      nome: "Nubank Investimentos",
    };
    const investimentoFixture = {
      id: 1,
      user_id: 1,
      nome: "Reserva de emergência",
      created_at: "2026-08-14T00:00:00Z",
      updated_at: "2026-08-14T00:00:00Z",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts" && method === "GET")
        return Promise.resolve(jsonResponse([investmentAccount]));
      if (url === "/investimentos") return Promise.resolve(jsonResponse([investimentoFixture]));
      if (url === "/pluggy/accounts/2" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...investmentAccount, investimento_id: 1 }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/Nubank Investimentos/);

    const select = await screen.findByLabelText("Investimento de Nubank Investimentos");
    await userEvent.selectOptions(select, "1");

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/accounts/2" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ apelido: null, sync_enabled: true, investimento_id: 1 });
    });
  });

  it("renders synced investment positions (holdings) with type, code fallback and formatted value", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([INVESTMENT_FIXTURE]));
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);

    expect(await screen.findByText(/CDB - NU FINANCEIRA/)).toBeInTheDocument();
    expect(screen.getByText(/FIXED_INCOME \/ CDB/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?22\.762,07/)).toBeInTheDocument();
  });

  it("linking a position to an investimento saves it via PUT /pluggy/investments/{id}", async () => {
    const investimentoFixture = {
      id: 1,
      user_id: 1,
      nome: "Reserva de emergência",
      created_at: "2026-08-14T00:00:00Z",
      updated_at: "2026-08-14T00:00:00Z",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments" && method === "GET")
        return Promise.resolve(jsonResponse([INVESTMENT_FIXTURE]));
      if (url === "/investimentos") return Promise.resolve(jsonResponse([investimentoFixture]));
      if (url === "/pluggy/investments/1" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...INVESTMENT_FIXTURE, investimento_id: 1 }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);

    const select = await screen.findByLabelText("Investimento de CDB - NU FINANCEIRA");
    await userEvent.selectOptions(select, "1");

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/investments/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ investimento_id: 1 });
    });
  });

  it("editing the position saldo inicial saves it via PUT /pluggy/investments/{id}/saldo-inicial", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments" && method === "GET")
        return Promise.resolve(jsonResponse([INVESTMENT_FIXTURE]));
      if (url === "/pluggy/investments/1/saldo-inicial" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...INVESTMENT_FIXTURE, saldo_inicial: "20000.00" }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/CDB - NU FINANCEIRA/);
    expect(screen.getByText(/não informado/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const input = screen.getByLabelText("Saldo inicial de CDB - NU FINANCEIRA");
    await userEvent.type(input, "20000");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/pluggy/investments/1/saldo-inicial" &&
          (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ saldo_inicial: "20000" });
    });
  });

  it("pre-selects a pending suggestion with confidence and accepts it via the button", async () => {
    const suggested = {
      ...INVESTMENT_FIXTURE,
      investimento_sugerido_id: 1,
      investimento_sugestao_confianca: "alta",
      investimento_sugestao_fonte_tipo: "codigo_exato",
    };
    const investimentoFixture = {
      id: 1,
      user_id: 1,
      nome: "Reserva de emergência",
      created_at: "2026-08-14T00:00:00Z",
      updated_at: "2026-08-14T00:00:00Z",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments" && method === "GET")
        return Promise.resolve(jsonResponse([suggested]));
      if (url === "/investimentos") return Promise.resolve(jsonResponse([investimentoFixture]));
      if (url === "/pluggy/investments/1" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...suggested, investimento_id: 1 }));
      }
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);

    const select = (await screen.findByLabelText(
      "Investimento de CDB - NU FINANCEIRA"
    )) as HTMLSelectElement;
    expect(select.value).toBe("1");
    expect(screen.getByText(/sugestão · confiança alta/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Aceitar sugestão" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/pluggy/investments/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ investimento_id: 1 });
    });
  });

  it("does not show a suggestion badge once a holding is already linked", async () => {
    const linked = { ...INVESTMENT_FIXTURE, investimento_id: 1, investimento_sugerido_id: 2 };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([linked]));
      if (url === "/investimentos") return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/CDB - NU FINANCEIRA/);

    expect(screen.queryByText(/sugestão · confiança/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar sugestão" })).not.toBeInTheDocument();
  });

  it("reviews the baseline proposal and confirms an edited value", async () => {
    const proposalLine = {
      investment_id: 1,
      nome: "CDB - NU FINANCEIRA",
      tipo: "FIXED_INCOME",
      codigo: null,
      saldo_atual: "22762.07",
      saldo_inicial_proposto: "20000.00",
      confianca: "estimada",
      motivo: "Estimado por fluxo reverso.",
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments" && method === "GET")
        return Promise.resolve(jsonResponse([INVESTMENT_FIXTURE]));
      if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
        return Promise.resolve(jsonResponse([]));
      if (url === "/pluggy/investments/baseline-dez-2025" && method === "GET") {
        return Promise.resolve(jsonResponse([proposalLine]));
      }
      if (url === "/pluggy/investments/baseline-dez-2025" && method === "POST") {
        return Promise.resolve(
          jsonResponse([{ ...INVESTMENT_FIXTURE, saldo_inicial: "21000.00" }])
        );
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<AccountManagementPage />);
    await screen.findByText(/CDB - NU FINANCEIRA/);

    await userEvent.click(screen.getByRole("button", { name: "Revisar proposta de baseline" }));

    const input = await screen.findByLabelText("Saldo inicial proposto de CDB - NU FINANCEIRA");
    expect((input as HTMLInputElement).value).toBe("20000.00");
    expect(screen.getByText("estimada")).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "21000");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar baseline" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/pluggy/investments/baseline-dez-2025" &&
          (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ linhas: [{ investment_id: 1, saldo_inicial: "21000" }] });
    });
  });

  it("renders the monthly audit table from evolucao-saldo-por-conta data", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
      if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
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
