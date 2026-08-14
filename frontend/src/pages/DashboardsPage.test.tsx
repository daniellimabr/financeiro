import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardsPage } from "./DashboardsPage";

const SUMMARY_FIXTURE = {
  receita: "8400.00",
  despesa: "5120.30",
  saldo: "3279.70",
  patrimonio: "142800.00",
};

const CATEGORIA_FIXTURE = [
  {
    group_id: 1,
    group_nome: "Alimentação",
    subcategory_id: 10,
    subcategory_nome: "Mercado",
    total: "1240.00",
  },
];

const MEIO_PAGAMENTO_FIXTURE = [{ account_tipo: "corrente", total: "1240.00" }];

const TRANSACAO_FIXTURE = {
  id: 1,
  account_id: 1,
  user_id: 1,
  pluggy_transaction_id: "tx-1",
  descricao: "Mercado São João",
  valor: "-45.00",
  tipo: "debito",
  data: "2026-01-10",
  data_competencia: "2026-01-10",
  subcategory_id: 10,
  categoria_pluggy: null,
  status: "efetivada",
  created_at: "2026-01-10T00:00:00Z",
  updated_at: "2026-01-10T00:00:00Z",
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

function routedFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/dashboards/summary"))
      return Promise.resolve(jsonResponse(SUMMARY_FIXTURE));
    if (url.startsWith("/dashboards/por-categoria"))
      return Promise.resolve(jsonResponse(CATEGORIA_FIXTURE));
    if (url.startsWith("/dashboards/por-meio-pagamento"))
      return Promise.resolve(jsonResponse(MEIO_PAGAMENTO_FIXTURE));
    if (url.startsWith("/pluggy/transactions"))
      return Promise.resolve(jsonResponse([TRANSACAO_FIXTURE]));
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe("DashboardsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the four summary cards from mocked data", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);

    expect(await screen.findByText("R$ 8.400,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 5.120,30")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.279,70")).toBeInTheDocument();
    expect(screen.getByText("R$ 142.800,00")).toBeInTheDocument();
  });

  it("refetches the summary when the month filter changes", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Janeiro");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.startsWith("/dashboards/summary") && url.includes("mes=1"))
      ).toBe(true);
    });
  });

  it("navigates the drill-down funnel from despesa to a transaction row and back", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await screen.findByText(/Mercado/);

    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Conta corrente");

    await userEvent.click(screen.getByRole("button", { name: /Conta corrente/ }));
    expect(await screen.findByText("Mercado São João")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "← Voltar" }));
    await screen.findByText("Conta corrente");

    await userEvent.click(screen.getByRole("button", { name: "← Voltar" }));
    await screen.findByText(/Mercado/);

    await userEvent.click(screen.getByRole("button", { name: "← Voltar" }));
    await waitFor(() => {
      expect(screen.queryByText(/Mercado/)).not.toBeInTheDocument();
    });
  });

  it("shows an empty state when there are no transactions in the period", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/dashboards/summary"))
        return Promise.resolve(jsonResponse(SUMMARY_FIXTURE));
      if (url.startsWith("/dashboards/por-categoria")) return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));

    expect(await screen.findByText("Nenhuma transação neste período.")).toBeInTheDocument();
  });
});
