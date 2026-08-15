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
    percentual: "62.50",
  },
  {
    group_id: 2,
    group_nome: "Transporte",
    subcategory_id: 20,
    subcategory_nome: "Combustível",
    total: "744.00",
    percentual: "37.50",
  },
];

const MEIO_PAGAMENTO_FIXTURE = [
  { account_tipo: "corrente", total: "1240.00", percentual: "100.00" },
];

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

const TENDENCIA_FIXTURE = [
  { ano: 2025, mes: 8, receita: "7000.00", despesa: "4800.00", saldo: "2200.00" },
  { ano: 2025, mes: 9, receita: "7200.00", despesa: "4900.00", saldo: "2300.00" },
  { ano: 2025, mes: 10, receita: "7600.00", despesa: "5000.00", saldo: "2600.00" },
  { ano: 2025, mes: 11, receita: "7800.00", despesa: "5050.00", saldo: "2750.00" },
  { ano: 2025, mes: 12, receita: "8100.00", despesa: "5100.00", saldo: "3000.00" },
  { ano: 2026, mes: 1, receita: "8400.00", despesa: "5120.30", saldo: "3279.70" },
];

const TENDENCIA_CATEGORIA_FIXTURE = [
  {
    subcategory_id: 10,
    subcategory_nome: "Mercado",
    pontos: [
      { ano: 2025, mes: 11, total: "1000.00" },
      { ano: 2025, mes: 12, total: "1100.00" },
      { ano: 2026, mes: 1, total: "1240.00" },
    ],
  },
  {
    subcategory_id: 20,
    subcategory_nome: "Combustível",
    pontos: [
      { ano: 2025, mes: 11, total: "600.00" },
      { ano: 2025, mes: 12, total: "700.00" },
      { ano: 2026, mes: 1, total: "744.00" },
    ],
  },
];

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
    if (url.startsWith("/dashboards/tendencia"))
      return Promise.resolve(jsonResponse(TENDENCIA_FIXTURE));
    if (url.startsWith("/dashboards/por-categoria/tendencia"))
      return Promise.resolve(jsonResponse(TENDENCIA_CATEGORIA_FIXTURE));
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

  it("renders a sparkline in the summary cards from mocked tendencia data", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await waitFor(() => {
      expect(container.querySelectorAll(".dash-tile .spark").length).toBeGreaterThan(0);
    });
  });

  it("refetches tendencia when the historical period selector changes", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.selectOptions(screen.getByLabelText("Período histórico"), "3");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.startsWith("/dashboards/tendencia") && url.includes("meses=3"))
      ).toBe(true);
    });
  });

  it("expands the sanfona funnel from despesa down to a transaction row without hiding prior levels", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await screen.findByRole("button", { name: /Mercado/ });

    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByRole("button", { name: /Conta corrente/ });
    expect(screen.getByRole("button", { name: /Mercado/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Conta corrente/ }));
    expect(await screen.findByText("Mercado São João")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mercado/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conta corrente/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Conta corrente/ }));
    await waitFor(() => {
      expect(screen.queryByText("Mercado São João")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Conta corrente/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Mercado/ })).not.toBeInTheDocument();
    });
  });

  it("keeps a first expanded categoria visible when a second one is expanded (sanfona)", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await screen.findByRole("button", { name: /Mercado/ });

    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByRole("button", { name: /Conta corrente/ });

    await userEvent.click(screen.getByRole("button", { name: /Combustível/ }));

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Conta corrente/ })).toHaveLength(2);
    });
    expect(screen.getByRole("button", { name: /Mercado/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("button", { name: /Combustível/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("shows percentual next to the value at each drill level", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await screen.findByText("62.5%");
    expect(screen.getByText("37.5%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    expect(await screen.findByText("100.0%")).toBeInTheDocument();
  });

  it("shows an empty state when there are no transactions in the period", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/dashboards/summary"))
        return Promise.resolve(jsonResponse(SUMMARY_FIXTURE));
      if (url.startsWith("/dashboards/tendencia"))
        return Promise.resolve(jsonResponse(TENDENCIA_FIXTURE));
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
