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
  ativos_totais: "151200.00",
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

const LIABILITIES_FIXTURE = [
  {
    id: 1,
    user_id: 1,
    nome: "Financiamento carro",
    tipo: "financiamento",
    valor_total: "60000.00",
    saldo_devedor: "7200.00",
    status: "ativo",
    data_quitacao: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const INVESTIMENTOS_FIXTURE = [
  {
    id: 1,
    user_id: 1,
    nome: "Reserva de emergência",
    valor_atual: "300.00",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const PLUGGY_INVESTMENTS_FIXTURE = [
  {
    id: 1,
    item_id: 1,
    user_id: 1,
    pluggy_investment_id: "inv-1",
    tipo: "cdb",
    subtipo: null,
    nome: "CDB Nubank 120%",
    codigo: null,
    quantidade: null,
    valor_investido: "290.00",
    valor_atual: "300.00",
    saldo_inicial: null,
    moeda: "BRL",
    investimento_id: 1,
    investimento_sugerido_id: null,
    investimento_sugestao_confianca: null,
    investimento_sugestao_fonte_tipo: null,
    investimento_sugestao_fonte_id: null,
    investimento_sugestao_score: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const EVOLUCAO_SALDO_FIXTURE = [
  {
    account_id: 1,
    account_nome: "Conta corrente",
    account_tipo: "corrente",
    saldo_inicial: "5000.00",
    pontos: [],
  },
  {
    account_id: 2,
    account_nome: "Cartão",
    account_tipo: "cartao_credito",
    saldo_inicial: "1000.00",
    pontos: [],
  },
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

// Tabela de conferência (PRD-032, Sprint 32) — Total + 2 contas corrente.
const SALDO_ACUMULADO_CONFERENCIA_FIXTURE = [
  {
    account_id: null,
    account_nome: "Total em Conta Corrente (100%)",
    saldo_inicio: "6000.00",
    receitas: "8400.00",
    despesas: "5120.30",
    saldo_fim: "9279.70",
    salario_recebido: "1000.00",
    saldo_efetivo: "8279.70",
  },
  {
    account_id: 1,
    account_nome: "Conta corrente",
    saldo_inicio: "5000.00",
    receitas: "8400.00",
    despesas: "5120.30",
    saldo_fim: "8279.70",
    salario_recebido: "1000.00",
    saldo_efetivo: "7279.70",
  },
  {
    account_id: 2,
    account_nome: "Conta XP",
    saldo_inicio: "1000.00",
    receitas: "0.00",
    despesas: "0.00",
    saldo_fim: "1000.00",
    salario_recebido: "0.00",
    saldo_efetivo: "1000.00",
  },
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
  data_editada_manualmente: false,
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

// formatCurrency usa Intl.NumberFormat, que separa "R$" do valor com um
// espaco NBSP (codepoint U+00A0) do valor - invisivel na tela mas diferente
// do espaco normal usado nos literais de teste abaixo. getByText normaliza
// isso sozinho, mas comparar .textContent bruto com toContain precisa da
// mesma normalizacao.
function normalizedText(el: HTMLElement): string {
  return (el.textContent ?? "").replace(/\u00A0/g, " ");
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
    if (url.startsWith("/dashboards/saldo-acumulado/conferencia"))
      return Promise.resolve(jsonResponse(SALDO_ACUMULADO_CONFERENCIA_FIXTURE));
    if (url.startsWith("/dashboards/saldo-acumulado"))
      return Promise.resolve(jsonResponse(SALDO_ACUMULADO_FIXTURE));
    if (url.startsWith("/category-groups")) return Promise.resolve(jsonResponse(GROUPS_FIXTURE));
    if (url.startsWith("/subcategories"))
      return Promise.resolve(jsonResponse(SUBCATEGORIES_FIXTURE));
    if (url.startsWith("/assets")) return Promise.resolve(jsonResponse(ASSETS_FIXTURE));
    if (url.startsWith("/liabilities")) return Promise.resolve(jsonResponse(LIABILITIES_FIXTURE));
    if (url.startsWith("/investimentos"))
      return Promise.resolve(jsonResponse(INVESTIMENTOS_FIXTURE));
    if (url.startsWith("/pluggy/investments"))
      return Promise.resolve(jsonResponse(PLUGGY_INVESTMENTS_FIXTURE));
    if (url.startsWith("/dashboards/evolucao-saldo-por-conta"))
      return Promise.resolve(jsonResponse(EVOLUCAO_SALDO_FIXTURE));
    if (url.startsWith("/pluggy/transactions"))
      return Promise.resolve(jsonResponse([TRANSACAO_FIXTURE, TRANSACAO_FIXTURE_2]));
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

// Mesmo roteamento de routedFetchMock, mas intercepta /dashboards/por-orcamento
// com um fixture próprio — evita adicionar orçamento a todos os testes do
// funil (mudaria o texto de .amt e quebraria asserções existentes de
// getByText em valores exatos).
function routedFetchMockWithOrcamento(orcamentoFixture: unknown) {
  const base = routedFetchMock();
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/dashboards/por-orcamento")) {
      return Promise.resolve(jsonResponse(orcamentoFixture));
    }
    return base(input, init);
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
    expect(screen.getByText("R$ 151.200,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 7.200,00")).toBeInTheDocument();
  });

  it("puts Ativos/Passivos/Patrimonio in their own row, separate from the month flow cards", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    const rows = container.querySelectorAll(".dash-summary");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("Ativos");
    expect(rows[0]?.textContent).toContain("Passivos");
    expect(rows[0]?.textContent).toContain("Patrimônio");
    expect(rows[0]?.textContent).not.toContain("Receita");
    expect(rows[1]?.textContent).toContain("Receita");
  });

  it("no longer shows the short disclaimer tags on Saldo Acumulado or Patrimonio", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    expect(
      screen.queryByText("projeção por competência — pode diferir do saldo bancário")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("atual, fora do filtro de período — sem histórico ainda")
    ).not.toBeInTheDocument();
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

  it("shows an overshoot alert (▲) on a Despesa subcategoria row when realizado exceeds orçado", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMockWithOrcamento([{ subcategory_id: 10, orcado: "500.00", realizado: "800.00" }])
    );

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await screen.findByRole("button", { name: /Mercado/ });
    const mercadoRow = accordionRowButton(/Mercado/);

    expect(normalizedText(mercadoRow)).toContain("estourou o orçado");
    expect(mercadoRow.querySelector(".track.orcamento-alerta")).not.toBeNull();

    // Restaurante não tem orçamento vigente — nenhum sinal, comportamento
    // idêntico ao de antes desta sprint.
    const restauranteRow = accordionRowButton(/Restaurante/);
    expect(normalizedText(restauranteRow)).not.toContain("orçado");
    expect(restauranteRow.querySelector(".track.orcamento-alerta")).toBeNull();
  });

  it("shows a shortfall alert (▼) on a Receita subcategoria row when realizado is below orçado", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMockWithOrcamento([{ subcategory_id: 10, orcado: "1000.00", realizado: "800.00" }])
    );

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Receita/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await screen.findByRole("button", { name: /Mercado/ });
    const mercadoRow = accordionRowButton(/Mercado/);

    expect(normalizedText(mercadoRow)).toContain("abaixo do orçado");
    expect(mercadoRow.querySelector(".track.orcamento-alerta")).not.toBeNull();
  });

  it("shows a muted 'de R$X orçado' subtext, no alert marker, when realizado is within budget", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetchMockWithOrcamento([{ subcategory_id: 10, orcado: "1000.00", realizado: "800.00" }])
    );

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await screen.findByRole("button", { name: /Mercado/ });
    const mercadoRow = accordionRowButton(/Mercado/);

    expect(normalizedText(mercadoRow)).toContain("de R$ 1.000,00 orçado");
    expect(mercadoRow.querySelector(".track.orcamento-alerta")).toBeNull();
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

  it("'ocultar gasto' toggles a transaction out of the grupo/subcategoria totals and the top Despesa/Saldo cards, without a new network request, while Ativos/Passivos/Patrimonio stay unchanged", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");

    expect(normalizedText(accordionRowButton(/Mercado/))).toContain("R$ 800,00");
    expect(normalizedText(accordionRowButton(/Alimentação/))).toContain("R$ 1.000,00");
    expect(screen.getByText("R$ 5.120,30")).toBeInTheDocument();

    const callsBefore = fetchMock.mock.calls.length;

    await userEvent.click(
      screen.getByRole("button", { name: "Ocultar transação Mercado São João (simulação)" })
    );

    // 45.00 sai do total do grupo/subcategoria e do card "Despesa" do topo
    // (5120.30 - 45 = 5075.30); "Saldo" sobe na mesma medida (receita fixa
    // menos despesa menor); Ativos/Passivos/Patrimônio, que não vêm do
    // mesmo período filtrado, ficam intocados. Tudo sem chamada de rede nova.
    await waitFor(() => {
      expect(normalizedText(accordionRowButton(/Mercado/))).toContain("R$ 755,00");
    });
    expect(normalizedText(accordionRowButton(/Alimentação/))).toContain("R$ 955,00");
    expect(screen.getByText("R$ 5.075,30")).toBeInTheDocument();
    expect(screen.getByText("R$ 3.324,70")).toBeInTheDocument();
    expect(screen.getByText("R$ 151.200,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 7.200,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 142.800,00")).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    await userEvent.click(
      screen.getByRole("button", { name: "Reexibir transação Mercado São João" })
    );
    await waitFor(() => {
      expect(normalizedText(accordionRowButton(/Mercado/))).toContain("R$ 800,00");
    });
    expect(normalizedText(accordionRowButton(/Alimentação/))).toContain("R$ 1.000,00");
    expect(screen.getByText("R$ 5.120,30")).toBeInTheDocument();
  });

  it("resets 'ocultar gasto' state when the funil closes or the month filter changes", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");
    await userEvent.click(
      screen.getByRole("button", { name: "Ocultar transação Mercado São João (simulação)" })
    );
    await waitFor(() => {
      expect(normalizedText(accordionRowButton(/Mercado/))).toContain("R$ 755,00");
    });

    // Fechar o funil e reabrir: item oculto some, volta ao valor original.
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    await userEvent.click(screen.getByRole("button", { name: /Alimentação/ }));
    await waitFor(() => {
      expect(normalizedText(accordionRowButton(/Mercado/))).toContain("R$ 800,00");
    });

    // Ocultar de novo e trocar o mês: reseta sem fechar o funil.
    await userEvent.click(screen.getByRole("button", { name: /Mercado/ }));
    await screen.findByText("Mercado São João");
    await userEvent.click(
      screen.getByRole("button", { name: "Ocultar transação Mercado São João (simulação)" })
    );
    await waitFor(() => {
      expect(normalizedText(accordionRowButton(/Mercado/))).toContain("R$ 755,00");
    });

    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Janeiro");
    await waitFor(() => {
      expect(normalizedText(accordionRowButton(/Mercado/))).toContain("R$ 800,00");
    });
  });

  it("shows a 'comparativo por categoria' chart inside the Despesa/Receita funil", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /Despesa/ }));
    expect(await screen.findByText("Comparativo por categoria")).toBeInTheDocument();
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

  it("opens the ativos drilldown showing the asset without a despesa/receita toggle (Sprint 28)", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));

    // "Despesas por Ativo" (accordion de gasto do período) saiu do
    // drilldown de Ativos nesta sprint — "Carro" aparece 1x só, na lista
    // "Valor atual por Ativo".
    expect(await screen.findAllByRole("button", { name: /Carro/ })).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "Tipo de transação" })).not.toBeInTheDocument();
  });

  it("shows Valor atual por Ativo, Valor atual por Investimento and Saldo por Conta Corrente, in that order", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));
    const [carroRow] = await screen.findAllByRole("button", { name: /Carro/ });

    const funnel = carroRow.closest(".dash-funnel") as HTMLElement;
    const headings = within(funnel)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Valor atual por Ativo",
      "Valor atual por Investimento",
      "Saldo por Conta Corrente",
    ]);

    // "Valor atual por Ativo" (AssetsValorAtualList, accordion desde a
    // Sprint 26) mostra o ativo do fixture
    expect(within(funnel).getByText("R$ 50.000,00")).toBeInTheDocument();
    expect(within(funnel).getByText("Reserva de emergência")).toBeInTheDocument();
    // "Saldo por Conta Corrente" (SaldoContaCorrenteList, Sprint 28) mostra
    // só a conta tipo=corrente do fixture (SALDO_FIXTURE também tem um
    // cartão de crédito, que não deve aparecer aqui).
    expect(within(funnel).getByText("Conta corrente")).toBeInTheDocument();
    expect(within(funnel).getByText("R$ 1.200,00")).toBeInTheDocument();
    expect(within(funnel).queryByText("Cartão")).not.toBeInTheDocument();
  });

  it("opens the passivos drilldown without a despesa/receita toggle when the Passivos card is clicked", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Passivos/ }));

    expect(await screen.findByRole("button", { name: /Financiamento carro/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Tipo de transação" })).not.toBeInTheDocument();
  });

  it("opens the Saldo drilldown showing the memoria de calculo (Receita - Despesa = Saldo), not a list of contas", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^SaldoR\$/ }));

    expect(await screen.findByText(/Receita R\$ 8\.400,00/)).toBeInTheDocument();
    expect(screen.getByText(/Despesa R\$ 5\.120,30/)).toBeInTheDocument();
    expect(screen.getByText(/Saldo R\$ 3\.279,70/)).toBeInTheDocument();
    // SaldoPorContaList (snapshot bancário) não é mais mostrada aqui — só no
    // card Ativos.
    expect(screen.queryByText("Conta corrente")).not.toBeInTheDocument();
  });

  function stubPatrimonioBreakdown(fetchMock: ReturnType<typeof routedFetchMock>) {
    const originalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/dashboards/patrimonio/breakdown")) {
        return Promise.resolve(
          jsonResponse({
            ativos_totais: "151200.00",
            passivos: "7200.00",
            saldo_acumulado_mes: "1200.00",
            total: "145200.00",
          })
        );
      }
      return originalFetch(input);
    });
  }

  it("opens the patrimonio breakdown as a 3-part accordion with a total, collapsed by default", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    stubPatrimonioBreakdown(fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Patrimônio/ }));

    expect(await screen.findByText("R$ 145.200,00")).toBeInTheDocument();
    const ativosRow = accordionRowButton(/^Ativos/);
    expect(ativosRow).toHaveAttribute("aria-expanded", "false");
    // Sem navegação — nenhum botão "Ver detalhe" nem heading separado.
    expect(screen.queryByRole("button", { name: "Ver detalhe" })).not.toBeInTheDocument();
  });

  it("expands the Ativos part of the patrimonio accordion showing its 3 sub-seções in place", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    stubPatrimonioBreakdown(fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Patrimônio/ }));
    await screen.findByText("R$ 145.200,00");

    await userEvent.click(accordionRowButton(/^Ativos/));

    // Ativos, dentro do accordion de Patrimônio, expande em 3 sub-seções:
    // Gestão de Ativos (AssetsValorAtualList), Investimentos
    // (InvestimentosValorAtualList) e Saldo por Conta Corrente
    // (SaldoContaCorrenteList) — mesmos componentes do drilldown do card
    // Ativos, sem duplicar busca de dado.
    const carroRow = await screen.findByRole("button", { name: /Carro/ });
    expect(accordionRowButton(/^Ativos/)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Reserva de emergência")).toBeInTheDocument();
    expect(screen.getByText("Conta corrente")).toBeInTheDocument();

    // "Carro" é o próprio Row expansível, que ao expandir mostra tipo + data
    // de aquisição.
    await userEvent.click(carroRow);
    expect(await screen.findByText(/Veículo · Adquirido em 2024-01-01/)).toBeInTheDocument();
  });

  it("expands the Passivos part of the patrimonio accordion showing the itemized valor atual list", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    stubPatrimonioBreakdown(fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Patrimônio/ }));
    await screen.findByText("R$ 145.200,00");

    await userEvent.click(accordionRowButton(/^Passivos/));

    expect(await screen.findByText("Financiamento carro")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 7.200,00").length).toBeGreaterThan(0);
  });

  it("expands the Saldo Acumulado do Mês part of the patrimonio accordion showing the trend chart", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    stubPatrimonioBreakdown(fetchMock);

    const { container } = renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Patrimônio/ }));
    await screen.findByText("R$ 145.200,00");

    await userEvent.click(accordionRowButton(/^Saldo Acumulado do Mês/));

    await waitFor(() => {
      expect(container.querySelector(".dash-chart")).not.toBeNull();
    });
  });

  it("shows percentual do total (Sprint 25) in Ativos, Passivos and Investimento-holdings valor atual lists", async () => {
    const ASSETS_2 = [
      { ...ASSETS_FIXTURE[0], id: 1, nome: "Carro", valor_atual: "800.00" },
      { ...ASSETS_FIXTURE[0], id: 2, nome: "Apartamento", valor_atual: "200.00" },
    ];
    const LIABILITIES_2 = [
      { ...LIABILITIES_FIXTURE[0], id: 1, nome: "Financiamento carro", saldo_devedor: "800.00" },
      { ...LIABILITIES_FIXTURE[0], id: 2, nome: "Cartão", saldo_devedor: "200.00" },
    ];
    const HOLDINGS_2 = [
      { ...PLUGGY_INVESTMENTS_FIXTURE[0], id: 1, nome: "CDB Nubank 120%", valor_atual: "800.00" },
      { ...PLUGGY_INVESTMENTS_FIXTURE[0], id: 2, nome: "Tesouro Selic", valor_atual: "200.00" },
    ];

    const base = routedFetchMock();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/assets")) return Promise.resolve(jsonResponse(ASSETS_2));
      if (url.startsWith("/liabilities")) return Promise.resolve(jsonResponse(LIABILITIES_2));
      if (url.startsWith("/pluggy/investments")) return Promise.resolve(jsonResponse(HOLDINGS_2));
      return base.getMockImplementation()!(input);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    // Ativos: tabela com coluna "%" — "Apartamento" só existe na lista de valor
    // atual (ATIVO_FIXTURE, usado pelo accordion de gasto no rodapé, só tem "Carro")
    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));
    await screen.findByText("Apartamento");
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.getByText("20.0%")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));

    // Passivos: dash-row bar+%, sem expandir — "Financiamento carro" também
    // aparece no PassivosAccordion (gasto do período, PASSIVO_FIXTURE) logo
    // acima; a lista "Passivos — saldo devedor" é a última ocorrência no DOM.
    await userEvent.click(screen.getByRole("button", { name: /^Passivos/ }));
    await screen.findByText("Cartão");
    const financiamentoOccurrences = screen.getAllByText("Financiamento carro");
    const financiamentoRow = financiamentoOccurrences[financiamentoOccurrences.length - 1];
    expect(financiamentoRow.closest(".dash-row")).toHaveTextContent("80.0%");
    expect(screen.getByText("Cartão").closest(".dash-row")).toHaveTextContent("20.0%");
    // não é mais uma tabela — sem expand
    expect(financiamentoRow.closest("table")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^Passivos/ }));

    // Holdings de Investimento: expandir "Reserva de emergência" pra ver as holdings
    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));
    await userEvent.click(await screen.findByRole("button", { name: /Reserva de emergência/ }));
    await screen.findByText("CDB Nubank 120%");
    expect(screen.getByText("Tesouro Selic")).toBeInTheDocument();
    expect(screen.getAllByText("80.0%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("20.0%").length).toBeGreaterThan(0);
  });

  it("colors each investimento row differently in Valor atual por Investimento (not a single fixed accent)", async () => {
    const INVESTIMENTOS_2 = [
      { ...INVESTIMENTOS_FIXTURE[0], id: 1, nome: "Reserva de emergência" },
      { ...INVESTIMENTOS_FIXTURE[0], id: 2, nome: "Aposentadoria" },
    ];
    const base = routedFetchMock();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/investimentos")) return Promise.resolve(jsonResponse(INVESTIMENTOS_2));
      return base.getMockImplementation()!(input);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));
    const reserva = await screen.findByRole("button", { name: /Reserva de emergência/ });
    const aposentadoria = screen.getByRole("button", { name: /Aposentadoria/ });

    const fillbarColor = (row: HTMLElement) => row.querySelector(".fillbar")?.getAttribute("style");
    expect(fillbarColor(reserva)).not.toBe(fillbarColor(aposentadoria));
  });

  it("adds regime=caixa to summary/tendencia requests when the Caixa toggle is selected, but not to saldo-acumulado", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: "Caixa" }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some((url) => url.startsWith("/dashboards/summary") && url.includes("regime=caixa"))
      ).toBe(true);
      expect(
        calls.some((url) => url.startsWith("/dashboards/tendencia") && url.includes("regime=caixa"))
      ).toBe(true);
    });

    // PRD-032: o card Saldo Acumulado não depende mais de regime — o
    // endpoint deixou de aceitar o parâmetro.
    const calls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(
      calls.some((url) => url.startsWith("/dashboards/saldo-acumulado") && url.includes("regime="))
    ).toBe(false);
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

  it("clicking the seta on Saldo Acumulado navigates to the next month without opening the drilldown", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");
    await userEvent.selectOptions(screen.getByLabelText("Ano"), "2025");
    await userEvent.selectOptions(screen.getByLabelText("Mês"), "Novembro");

    await userEvent.click(screen.getByRole("button", { name: "Ver mês seguinte" }));

    await waitFor(() => {
      expect((screen.getByLabelText("Mês") as HTMLSelectElement).value).toBe("12");
    });
    expect((screen.getByLabelText("Ano") as HTMLSelectElement).value).toBe("2025");
    expect(screen.queryByRole("heading", { name: "Saldo Acumulado" })).not.toBeInTheDocument();
  });

  it("clicking the seta on Saldo Acumulado in the current real month alerts instead of navigating", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.stubGlobal("fetch", routedFetchMock());
    // now() é jan/2026 por padrão no componente — o filtro inicial já é o
    // mês corrente real, sem precisar mudar o seletor.

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: "Ver mês seguinte" }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Mês") as HTMLSelectElement).value).toBe(
      String(new Date().getMonth() + 1)
    );
    alertSpy.mockRestore();
  });

  it("clicking the body of the Saldo Acumulado card opens the drilldown (arrow click does not)", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByText("Saldo Acumulado"));

    expect(await screen.findByRole("heading", { name: "Saldo Acumulado" })).toBeInTheDocument();
  });

  it("expands an Investimento row to show its holdings (Investimento to Holding accordion)", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Ativos/ }));
    await screen.findByText("Reserva de emergência");

    expect(screen.queryByText("CDB Nubank 120%")).not.toBeInTheDocument();

    await userEvent.click(accordionRowButton(/Reserva de emergência/));

    expect(await screen.findByText("CDB Nubank 120%")).toBeInTheDocument();
  });

  it("shows the Saldo Acumulado conferencia table (Total + one row per conta) above the trend chart", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Saldo Acumulado/ }));
    await screen.findByRole("heading", { name: "Saldo Acumulado" });

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Total em Conta Corrente (100%)")).toBeInTheDocument();
    expect(within(table).getByText("Conta corrente")).toBeInTheDocument();
    expect(within(table).getByText("Conta XP")).toBeInTheDocument();

    const rows = within(table).getAllByRole("row");
    // header + Total + 2 contas
    expect(rows).toHaveLength(4);
    function saldoEfetivoCell(row: HTMLElement) {
      const cells = within(row).getAllByRole("cell");
      return cells[cells.length - 1]?.textContent;
    }
    // Saldo efetivo (última coluna) de cada linha — Total = 6.000+8.400-
    // 5.120,30-1.000 = 8.279,70; conta corrente = 7.279,70; conta XP = 1.000.
    expect(saldoEfetivoCell(rows[1]!)).toContain("8.279,70");
    expect(saldoEfetivoCell(rows[2]!)).toContain("7.279,70");
    expect(saldoEfetivoCell(rows[3]!)).toContain("1.000,00");
  });

  it("does not render an accordion/expand control on the Saldo Acumulado conferencia table", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<DashboardsPage />);
    await screen.findByText("R$ 8.400,00");

    await userEvent.click(screen.getByRole("button", { name: /^Saldo Acumulado/ }));
    const table = await screen.findByRole("table");

    expect(within(table).queryAllByRole("button")).toHaveLength(0);
  });
});
