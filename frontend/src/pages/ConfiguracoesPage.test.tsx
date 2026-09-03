import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "../api/auth";
import { enterDemoUrl } from "../api/demo";
import { ConfiguracoesPage } from "./ConfiguracoesPage";

const USER: CurrentUser = {
  id: 1,
  email: "alice@example.com",
  name: "Alice",
  salario_competencia_cutoff_dia: 25,
  is_demo: false,
  created_at: "2026-01-01T00:00:00Z",
};

const CEO_USER: CurrentUser = {
  ...USER,
  id: 2,
  email: "daniellimabr@gmail.com",
  name: "Daniel",
};

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
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function routedFetchMock() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/pluggy/items") return Promise.resolve(jsonResponse([ITEM_FIXTURE]));
    if (url === "/pluggy/accounts") return Promise.resolve(jsonResponse([ACCOUNT_FIXTURE]));
    if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
      return Promise.resolve(jsonResponse([]));
    if (url === "/pluggy/ajuste-salario-dezembro" && method === "GET")
      return Promise.resolve(jsonResponse(null));
    if (url === "/auth/logout" && method === "POST")
      return Promise.resolve(jsonResponse(null, 204));
    if (url === "/demo/reset" && method === "POST") return Promise.resolve(jsonResponse(null, 204));
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
}

describe("ConfiguracoesPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Perfil, Competência de Salário and Contas sections", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<ConfiguracoesPage user={USER} />);

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Competência de Salário" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar contas" })).toBeInTheDocument();
  });

  it("opens the Gestão de contas drawer via 'Gerenciar contas'", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<ConfiguracoesPage user={USER} />);

    expect(screen.queryByRole("dialog", { name: "Gestão de contas" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Gerenciar contas" }));

    const drawer = screen.getByRole("dialog", { name: "Gestão de contas" });
    expect(await within(drawer).findByText(/Conta Corrente/)).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole("button", { name: "Fechar" }));

    expect(screen.queryByRole("dialog", { name: "Gestão de contas" })).not.toBeInTheDocument();
  });

  it("clicking Sair calls POST /auth/logout", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ConfiguracoesPage user={USER} />);

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/auth/logout" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("submitting the dia de corte form calls PUT /auth/me/settings", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/auth/me/settings" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...USER, salario_competencia_cutoff_dia: 10 }));
      }
      return routedFetchMock()(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ConfiguracoesPage user={USER} />);

    const input = screen.getByLabelText("Dia de corte de competência de salário");
    await userEvent.clear(input);
    await userEvent.type(input, "10");
    await userEvent.click(screen.getByRole("button", { name: "Salvar dia de corte" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/auth/me/settings" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ cutoff_dia: 10 });
    });
  });

  it("submitting the salário de dezembro/2025 form calls PUT /pluggy/ajuste-salario-dezembro", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/pluggy/ajuste-salario-dezembro" && method === "PUT") {
        return Promise.resolve(
          jsonResponse({ account_id: 1, data: "2025-12-30", valor: "5000.00" })
        );
      }
      return routedFetchMock()(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ConfiguracoesPage user={USER} />);
    await screen.findByText(/Conta Corrente/);

    await userEvent.selectOptions(screen.getByLabelText("Conta do salário de dezembro/2025"), "1");
    await userEvent.type(screen.getByLabelText("Valor do salário de dezembro/2025"), "5000");
    const submitButtons = screen.getAllByRole("button", { name: "Salvar" });
    await userEvent.click(submitButtons[0]);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/pluggy/ajuste-salario-dezembro" &&
          (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ account_id: 1, data: "2025-12-30", valor: "5000" });
    });
  });

  it("does not render the Modo Demo panel for a non-CEO email", () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<ConfiguracoesPage user={USER} />);

    expect(screen.queryByRole("heading", { name: "Modo Demo" })).not.toBeInTheDocument();
  });

  it("renders the Modo Demo panel for the CEO email", () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<ConfiguracoesPage user={CEO_USER} />);

    expect(screen.getByRole("heading", { name: "Modo Demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar no modo demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resetar dados demo" })).toBeInTheDocument();
  });

  it("clicking Entrar no modo demo, after confirming, navigates to /demo/enter", async () => {
    vi.stubGlobal("fetch", routedFetchMock());
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    renderWithQueryClient(<ConfiguracoesPage user={CEO_USER} />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar no modo demo" }));

    expect(window.location.href).toBe(enterDemoUrl);

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("clicking Entrar no modo demo, without confirming, does not navigate", async () => {
    vi.stubGlobal("fetch", routedFetchMock());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });

    renderWithQueryClient(<ConfiguracoesPage user={CEO_USER} />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar no modo demo" }));

    expect(window.location.href).toBe("");

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("clicking Resetar dados demo, after confirming, calls POST /demo/reset", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithQueryClient(<ConfiguracoesPage user={CEO_USER} />);
    await userEvent.click(screen.getByRole("button", { name: "Resetar dados demo" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/demo/reset" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("clicking Resetar dados demo, without confirming, does not call the API", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithQueryClient(<ConfiguracoesPage user={CEO_USER} />);
    await userEvent.click(screen.getByRole("button", { name: "Resetar dados demo" }));

    const call = fetchMock.mock.calls.find((c) => String(c[0]) === "/demo/reset");
    expect(call).toBeUndefined();
  });
});
