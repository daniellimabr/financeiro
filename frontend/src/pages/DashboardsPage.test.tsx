import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardsPage } from "./DashboardsPage";

const SUMMARY_FIXTURE = {
  receita: "8400.00",
  despesa: "5120.30",
  saldo: "3279.70",
  patrimonio: "142800.00",
  ativos: "150000.00",
  passivos: "7200.00",
};

const GROUPS_FIXTURE = [
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

const SUBCATEGORIES_FIXTURE = [
  {
    id: 10,
    group_id: 1,
    nome: "Mercado",
    natureza: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 11,
    group_id: 1,
    nome: "Restaurante",
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

// Alimentação (grupo) = Mercado 800 + Restaurante 200 = 1000 (80%/20% dentro
// do grupo); Transporte (grupo) = Combustível 1000. Total geral 2000 — cada
// grupo fica em 50% do total, números redondos de propósito pra facilitar
// as asserções de percentual.
const CATEGORIA_FIXTURE = [
  {
    group_id: 1,
    group_nome: "Alimentação",
    subcategory_id: 10,
    subcategory_nome: "Mercado",
    total: "800.00",
    percentual: "0",
  },
  {
    group_id: 1,
    group_nome: "Alimentação",
    subcategory_id: 11,
    subcategory_nome: "Restaurante",
    total: "200.00",
    percentual: "0",
  },
  {
    group_id: 2,
    group_nome: "Transporte",
    subcategory_id: 20,
    subcategory_nome: "Combustível",
    total: "1000.00",
    percentual: "0",
  },
];

const ATIVO_FIXTURE = [{ asset_id: 1, asset_nome: "Carro", total: "300.00" }];

const ASSETS_FIXTURE = [
  {
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
  },
];

const PASSIVO_FIXTURE = [
  { liability_id: 1, liability_nome: "Financiamento carro", total: "500.00" },
];

// 7 pontos (histórico default de 6 meses + 1 ponto extra pro card "Saldo
// Anterior", ver useDashboardSaldoAcumulado) — o penúltimo ponto (dez/2025,
// 11500.00) é o "mês anterior" ao último (jan/2026, 12000.00, mês filtrado).
const SALDO_ACUMULADO_FIXTURE = [
  { ano: 2025, mes: 7, total: "9000.00" },
  { ano: 2025, mes: 8, total: "9500.00" },
  { ano: 2025, mes: 9, total: "10000.00" },
  { ano: 2025, mes: 10, total: "10500.00" },
  { ano: 2025, mes: 11, total: "11000.00" },
  { ano: 2025, mes: 12, total: "11500.00" },
  { ano: 2026, mes: 1, total: "12000.00" },
];

const SALDO_FIXTURE = [
  {
    account_id: 1,
    account_nome: "Conta corrente",
    account_tipo: "corrente",
    saldo: "1200.00",
    limite_credito: null,
  },
  {
    account_id: 2,
    account_nome: "Cartão",
    account_tipo: "cartao_credito",
    saldo: "300.00",
    limite_credito: "5000.00",
  },
];

const TRANSACAO_FIXTURE = {
  id: 1,
  account_id: 1,
  user_id: 1,
  pluggy_transaction_id: "tx-1",
  descricao: "Mercado São João",
  descricao_usuario: null,
  descricao_sugerida: null,
  valor: "-45.00",
  tipo: "debito",
  data: "2026-01-10",
  data_competencia: "2026-01-10",
  subcategory_id: 10,
  subcategoria_sugerida_id: null,
  categoria_pluggy: null,
  status: "efetivada",
  account_tipo: "corrente",
  asset_id: null,
  asset_sugerido_id: null,
  created_at: "2026-01-10T00:00:00Z",
  updated_at: "2026-01-10T00:00:00Z",
};

const TRANSACAO_FIXTURE_2 = {
  ...TRANSACAO_FIXTURE,
  id: 2,
  pluggy_transaction_id: "tx-2",
  descricao: "Açougue Bairro",
  valor: "-15.00",
  data: "2026-01-05",
  account_tipo: "cartao_credito",
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
      { ano: 2025, mes: 11, total: "700.00" },
      { ano: 2025, mes: 12, total: "750.00" },
      { ano: 2026, mes: 1, total: "800.00" },
    ],
  },
  {
    subcategory_id: 20,
    subcategory_nome: "Combustível",
    pontos: [
      { ano: 2025, mes: 11, total: "900.00" },
      { ano: 2025, mes: 12, total: "950.00" },
      { ano: 2026, mes: 1, total: "1000.00" },
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

// A partir da Sprint 10, a linha de transação também renderiza um botão de
// descrição editável (DescriptionCell) — quando o nome da subcategoria é um
// prefixo da descrição da transação (ex.: "Mercado" / "Mercado São João"),
// uma query `getByRole("button", { name: /Mercado/ })` fica ambígua depois
// que a tabela de transações é expandida. Este helper escopa a busca ao
// botão do próprio accordion (classe "dash-row"), nunca à célula de edição.
function accordionRowButton(name: string | RegExp): HTMLElement {
  const button = screen
    .getAllByRole("button", { name })
    .find((el) => el.classList.contains("dash-row"));
  if (!button) throw new Error(`Nenhum botão de accordion encontrado para "${name}"`);
  return button;
}

function routedFetchMock() {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const url = String(input);
    if (url.startsWith("/dashboards/summary"))
      return Promise.resolve(jsonResponse(SUMMARY_FIXTURE));
    if (url.startsWith("/dashboards/tendencia"))
      return Promise.resolve(jsonResponse(TENDENCIA_FIXTURE));
    if (url.startsWith("/dashboards/por-categoria/tendencia"))
      return Promise.resolve(jsonResponse(TENDENCIA_CATEGORIA_FIXTURE));
    if (url.startsWith("/dashboards/por-categoria"))
      return Promise.resolve(jsonResponse(CATEGORIA_FIXTURE));
    if (url.startsWith("/dashboards/por-ativo"))
      return Promise.resolve(jsonResponse(ATIVO_FIXTURE));
    if (url.startsWith("/dashboards/por-passivo"))
      return Promise.resolve(jsonResponse(PASSIVO_FIXTURE));
    if (url.startsWith("/dashboards/saldo-por-conta"))
      return Promise.resolve(jsonResponse(SALDO_FIXTURE));
    if (url.startsWith("/dashboards/saldo-acumulado"))
      return Promise.resolve(jsonResponse(SALDO_ACUMULADO_FIXTURE));
    if (url.startsWith("/category-groups")) return Promise.resolve(jsonResponse(GROUPS_FIXTURE));
    if (url.startsWith("/subcategories"))
      return Promise.resolve(jsonResponse(SUBCATEGORIES_FIXTURE));
    if (url.startsWith("/assets")) return Promise.resolve(jsonResponse(ASSETS_FIXTURE));
    if (url.startsWith("/pluggy/transactions"))
      return Promise.resolve(jsonResponse([TRANSACAO_FIXTURE, TRANSACAO_FIXTURE_2]));
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe("DashboardsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the summary cards from mocked data, including ativos and passivos", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);

    expect(await screen.findByText("R$ 8.400,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 5.120,30")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.279,70")).toBeInTheDocument();
    expect(screen.getByText("R$ 142.800,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 150.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 7.200,00")).toBeInTheDocument();
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

  it("expands the funnel from despesa through grupo and tipo down to the transaction list", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await screen.findByRole("button", { name: /Alimentação/ });
    expect(screen.queryByText("Mercado")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await screen.findByRole("button", { name: /Mercado/ });
    expect(screen.queryByText("Mercado São João")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    expect(await screen.findByText("Mercado São João")).toBeInTheDocument();

    await userEvent.click(accordionRowButton(/Mercado/));
    await waitFor(() => {
      expect(screen.queryByText("Mercado São João")).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Alimentação/ })).not.toBeInTheDocument();
    });
  });

  it("keeps a first expanded grupo visible when a second grupo is expanded (sanfona)", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await screen.findByRole("button", { name: /Alimentação/ });

    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await screen.findByRole("button", { name: /Mercado/ });

    await userEvent.click(screen.getByRole("button", { name: /Transporte/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Alimentação/ })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      expect(screen.getByRole("button", { name: /Transporte/ })).toHaveAttribute(
        "aria-expanded",
        "true"
      );
    });
  });

  it("keeps a first expanded tipo visible when a second tipo in the same grupo is expanded", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await screen.findByRole("button", { name: /Mercado/ });

    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");

    await userEvent.click(screen.getByRole("button", { name: /Restaurante/ }));

    await waitFor(() => {
      expect(accordionRowButton(/Mercado/)).toHaveAttribute("aria-expanded", "true");
      expect(accordionRowButton(/Restaurante/)).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("shows percentual at grupo level (vs total), tipo level (vs grupo) and transaction level (vs tipo)", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    // Alimentação (1000) e Transporte (1000) — 50% cada do total (2000)
    expect(await screen.findAllByText("50.0%")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    // Mercado (800) / grupo Alimentação (1000) = 80%; Restaurante = 20%
    expect(await screen.findByText("80.0%")).toBeInTheDocument();
    expect(screen.getByText("20.0%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    // 45.00 / 800.00 (total do tipo "Mercado")
    expect(await screen.findByText("5.6%")).toBeInTheDocument();
  });

  it("shows an empty state when there are no transactions in the period", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/dashboards/summary"))
        return Promise.resolve(jsonResponse(SUMMARY_FIXTURE));
      if (url.startsWith("/dashboards/tendencia"))
        return Promise.resolve(jsonResponse(TENDENCIA_FIXTURE));
      if (url.startsWith("/dashboards/por-categoria")) return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/dashboards/saldo-acumulado"))
        return Promise.resolve(jsonResponse(SALDO_ACUMULADO_FIXTURE));
      if (url.startsWith("/category-groups")) return Promise.resolve(jsonResponse(GROUPS_FIXTURE));
      if (url.startsWith("/subcategories"))
        return Promise.resolve(jsonResponse(SUBCATEGORIES_FIXTURE));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));

    expect(await screen.findByText("Nenhuma transação neste período.")).toBeInTheDocument();
  });

  it("each transaction row renders an account tipo icon to the left of the value", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");

    const valorCell = document.querySelector(".dash-table tbody .valor-cell");
    expect(valorCell).not.toBeNull();
    expect(valorCell?.querySelector(".account-tipo-icon")).not.toBeNull();
    expect(valorCell?.textContent).toContain("R$");
  });

  it("reorders the transaction table when a column header is clicked", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");

    function rowsDescricao() {
      return within(screen.getByRole("table"))
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[1].textContent);
    }

    // default: data desc — tx-1 (2026-01-10) antes de tx-2 (2026-01-05)
    expect(rowsDescricao()).toEqual(["Mercado São João", "Açougue Bairro"]);

    await userEvent.click(screen.getByRole("button", { name: "Data" }));
    await waitFor(() => {
      expect(rowsDescricao()).toEqual(["Açougue Bairro", "Mercado São João"]);
    });
  });

  it("sorts the transaction table by percentual when its column header is clicked", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");

    const percentHeader = screen.getByRole("button", { name: "%" });
    expect(percentHeader).toBeInTheDocument();

    await userEvent.click(percentHeader);
    await waitFor(() => {
      expect(percentHeader.closest("th")).toHaveAttribute("aria-sort", "ascending");
    });
  });

  it("opens the ativos drilldown with despesa/receita toggle when the Ativos card is clicked", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));

    expect(await screen.findByRole("button", { name: /Carro/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tipo de transação" })).toBeInTheDocument();
  });

  it("opens the passivos drilldown without a despesa/receita toggle when the Passivos card is clicked", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Passivos/ }));

    expect(await screen.findByRole("button", { name: /Financiamento carro/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tipo de transação" })).not.toBeInTheDocument();
  });

  it("opens the saldo por conta drilldown and ignores the ano/mes filter", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^SaldoR\$/ }));
    expect(await screen.findByText("R$ 1.200,00")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Janeiro");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      const saldoCalls = calls.filter((url) => url.startsWith("/dashboards/saldo-por-conta"));
      expect(saldoCalls.every((url) => !url.includes("mes="))).toBe(true);
    });
    expect(screen.getByText("R$ 1.200,00")).toBeInTheDocument();
  });

  it("opens the patrimonio breakdown showing the 4 parts and links to the existing drilldowns", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const originalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/dashboards/patrimonio/breakdown")) {
        return Promise.resolve(
          jsonResponse({
            ativos: "150000.00",
            passivos: "7200.00",
            saldo_contas: "1200.00",
            saldo_cartoes: "300.00",
            total: "143700.00",
          })
        );
      }
      return originalFetch(input);
    });

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Patrimônio/ }));

    expect(await screen.findByText("R$ 143.700,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 150.000,00").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 1.200,00")).toBeInTheDocument();

    const detalheButtons = screen.getAllByRole("button", { name: "Ver detalhe" });
    await userEvent.click(detalheButtons[0]);

    expect(await screen.findByRole("button", { name: /Carro/ })).toBeInTheDocument();
  });

  it("editing a transaction's category from the drilldown invalidates the dashboard summary", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    const originalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/categorization/transactions/1/category" && method === "PUT") {
        return Promise.resolve(jsonResponse({ ...TRANSACAO_FIXTURE, subcategory_id: 11 }));
      }
      return originalFetch(input);
    });

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");

    await userEvent.click(screen.getByLabelText("Categoria de Mercado São João"));
    await userEvent.click(screen.getByRole("option", { name: "Restaurante" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/categorization/transactions/1/category" &&
          (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
    });

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      const summaryCalls = calls.filter((url) => url.startsWith("/dashboards/summary"));
      // refetch automático (invalidação) além da chamada inicial
      expect(summaryCalls.length).toBeGreaterThan(1);
    });
  });

  it("requests the transaction list scoped to the funil's tipo, not mixing debito/credito under a shared subcategoria", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      const chamadaTransacoes = calls.find(
        (url) => url.startsWith("/pluggy/transactions") && url.includes("subcategory_id=10")
      );
      expect(chamadaTransacoes).toBeDefined();
      expect(chamadaTransacoes).toContain("tipo=debito");
    });
  });

  it("shows the credit limit in parentheses next to a credit card balance", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^SaldoR\$/ }));

    expect(await screen.findByText(/limite R\$ 5\.000,00/)).toBeInTheDocument();
  });

  it("renders Saldo Acumulado (last point) and Saldo Anterior (penultimate point, labeled) cards", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    expect(await screen.findByText("R$ 12.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 11.500,00")).toBeInTheDocument();
    expect(screen.getByText(/Saldo Anterior \(12\/2025\)/)).toBeInTheDocument();
  });

  it("clicking Saldo Anterior in January/2026 alerts instead of navigating", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");
    await userEvent.selectOptions(screen.getByLabelText("Ano"), "2026");
    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Janeiro");

    await userEvent.click(screen.getByRole("button", { name: /Saldo Anterior/ }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Mês") as HTMLSelectElement).value).toBe("1");
    alertSpy.mockRestore();
  });

  it("clicking Saldo Anterior outside January/2026 navigates the filter to the previous month", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");
    await userEvent.selectOptions(screen.getByLabelText("Ano"), "2026");
    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Março");

    await userEvent.click(screen.getByRole("button", { name: /Saldo Anterior/ }));

    await waitFor(() => {
      expect((screen.getByLabelText("Mês") as HTMLSelectElement).value).toBe("2");
    });
    expect((screen.getByLabelText("Ano") as HTMLSelectElement).value).toBe("2026");
  });

  it("opens the Saldo Acumulado drilldown with a trend chart when the card is clicked", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Saldo Acumulado/ }));

    expect(await screen.findByRole("heading", { name: "Saldo Acumulado" })).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector(".dash-chart")).not.toBeNull();
    });
  });
});
