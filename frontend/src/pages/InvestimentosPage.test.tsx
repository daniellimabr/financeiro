import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

const TRANSACAO_CONTA_FIXTURE = {
  data: "2026-01-10",
  tipo: "debito",
  descricao: "PIX Itaú->Nubank",
  valor: "-150.00",
  origem: "conta",
  holding_nome: null,
};

const TRANSACAO_HOLDING_FIXTURE = {
  data: "2026-01-03",
  tipo: "BUY",
  descricao: null,
  valor: "5000.00",
  origem: "holding",
  holding_nome: "CDB - NU FINANCEIRA",
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

// ano_mes ("YYYY-MM") do mês corrente real e do anterior — mesmo raciocínio
// de mesAnteriorDoHoje em DashboardsPage.test.tsx: o filtro inicial da
// página usa `new Date()`, então os testes de KPI consolidado calculam o
// mês esperado a partir de "agora" em vez de fixar uma data.
function anoMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function mesAtualEAnteriorAnoMes(): { atual: string; anterior: string } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  return { atual: anoMes(ano, mes), anterior: anoMes(anterior.ano, anterior.mes) };
}

// Toda renderização de InvestimentosPage dispara, pra cada investimento:
// tendência de aporte/resgate (funil de Extrato), evolução em tempo real
// (valor do tile) e evolução mensal (sparkline do tile + ranking); e, pra
// página como um todo, a evolução mensal consolidada (KPIs + gráfico). O
// helper cobre esse conjunto com um default vazio/zerado pra todo teste que
// não precisa customizar um deles.
function baseHandlers(url: string): Promise<Response> | null {
  if (url.startsWith("/dashboards/por-investimento/tendencia")) {
    return Promise.resolve(jsonResponse([]));
  }
  if (url === "/pluggy/investments") return Promise.resolve(jsonResponse([]));
  if (url.endsWith("/evolucao")) return Promise.resolve(jsonResponse(EVOLUCAO_FIXTURE));
  if (url.endsWith("/evolucao-mensal")) return Promise.resolve(jsonResponse([]));
  return null;
}

async function abrirFunil() {
  await userEvent.click(screen.getByRole("button", { name: /Reserva de emergência/ }));
}

describe("InvestimentosPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists investimentos as tiles with saldo atual and rendimento estimado, without loose carteiras/posições text", async () => {
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
    expect(await screen.findByText("R$ 1.200,00")).toBeInTheDocument();
    expect(await screen.findByText(/Rendimento estimado: R\$\s?50,00/)).toBeInTheDocument();
    expect(screen.queryByText(/Carteiras:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Posições:/)).not.toBeInTheDocument();
  });

  it("shows an empty state and no consolidated section when there are no investimentos", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const base = baseHandlers(url);
      if (base) return base;
      if (url === "/investimentos") return Promise.resolve(jsonResponse([]));
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);

    expect(await screen.findByText("Nenhum investimento cadastrado.")).toBeInTheDocument();
    expect(screen.queryByText("Patrimônio Investido")).not.toBeInTheDocument();
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

  it("edits an existing investimento via PUT /investimentos/{id}, from inside the funil", async () => {
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
    await abrirFunil();

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

  it("deletes an investimento after confirmation via DELETE /investimentos/{id}, from inside the funil", async () => {
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
    await abrirFunil();

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/investimentos/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("clicking an investimento tile opens the funil defaulting to Posições", async () => {
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
    await screen.findByText("Reserva de emergência");
    await abrirFunil();

    expect(screen.getByRole("button", { name: "Posições" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    const posicaoText = await screen.findByText("CDB - NU FINANCEIRA");
    expect(posicaoText.closest(".dash-funnel")).not.toBeNull();
  });

  it("shows the unified extrato (conta + holding) in the Extrato tab, toggling Aporte/Resgate's period total", async () => {
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
      if (url.startsWith("/investimentos/1/transacoes")) {
        return Promise.resolve(jsonResponse([TRANSACAO_HOLDING_FIXTURE, TRANSACAO_CONTA_FIXTURE]));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");
    await abrirFunil();
    await userEvent.click(screen.getByRole("button", { name: "Extrato" }));

    expect(await screen.findByText("R$ 150,00")).toBeInTheDocument();
    // origem "conta" (com descricao) e "holding" (sem descricao, cai no holding_nome)
    expect(screen.getByText("PIX Itaú->Nubank")).toBeInTheDocument();
    expect(screen.getByText("CDB - NU FINANCEIRA")).toBeInTheDocument();
    expect(screen.getByText("Conta")).toBeInTheDocument();
    expect(screen.getByText("Holding")).toBeInTheDocument();
    expect(document.querySelector(".extrato-unificado-table colgroup")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Resgate" }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(
        calls.some(
          (url) => url.includes("/dashboards/por-investimento") && url.includes("tipo=credito")
        )
      ).toBe(true);
    });
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
    await abrirFunil();

    expect(await screen.findByText("CDB - NU FINANCEIRA")).toBeInTheDocument();
    expect(screen.getByText("FIXED_INCOME / CDB")).toBeInTheDocument();
    expect(screen.getByText("R$ 22.762,07")).toBeInTheDocument();
    expect(document.querySelector(".posicoes-table colgroup")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Ver histórico" }));

    expect(await screen.findByText("SELL")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.398,87")).toBeInTheDocument();
    expect(document.querySelector(".posicao-historico-table colgroup")).not.toBeNull();
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
    await abrirFunil();
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
    await abrirFunil();
    await userEvent.click(screen.getByRole("button", { name: "Série histórica" }));

    expect(await screen.findByText(/Nenhum snapshot mensal ainda/)).toBeInTheDocument();
  });

  it("renders a sparkline on the entry tile when monthly evolution data is available", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      if (url === "/investimentos/1/evolucao-mensal") {
        return Promise.resolve(
          jsonResponse([
            {
              ano_mes: "2025-12",
              saldo: "1000.00",
              valorizacao: "0",
              rendimento: "0",
              dividendos: "0",
              aportes: "0",
              resgates: "0",
              confianca: "real",
            },
            {
              ano_mes: "2026-01",
              saldo: "1200.00",
              valorizacao: "0",
              rendimento: "0",
              dividendos: "0",
              aportes: "0",
              resgates: "0",
              confianca: "real",
            },
          ])
        );
      }
      const base = baseHandlers(url);
      if (base) return base;
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    await waitFor(() => {
      expect(container.querySelectorAll(".ac-kpi .spark").length).toBeGreaterThan(0);
    });
  });

  it("shows consolidated KPIs and the desempenho ranking sourced from the aggregated endpoint", async () => {
    const { atual, anterior } = mesAtualEAnteriorAnoMes();
    const consolidadaFixture = [
      {
        ano_mes: anterior,
        saldo: "10000.00",
        valorizacao: "0",
        rendimento: "200.00",
        dividendos: "0",
        aportes: "500.00",
        resgates: "0.00",
        confianca: "real",
      },
      {
        ano_mes: atual,
        saldo: "11000.00",
        valorizacao: "0",
        rendimento: "300.00",
        dividendos: "0",
        aportes: "600.00",
        resgates: "100.00",
        confianca: "real",
      },
    ];
    const porInvestimentoFixture = [
      {
        ano_mes: atual,
        saldo: "11000.00",
        valorizacao: "0",
        // Deliberadamente diferente do "rendimento" da série consolidada
        // acima (mesmo valor numérico colidiria no getByText — os dois vêm
        // de fontes/queries distintas nesta tela, não precisam bater aqui).
        rendimento: "280.00",
        dividendos: "0",
        aportes: "600.00",
        resgates: "100.00",
        confianca: "real",
      },
    ];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      if (url === "/investimentos/evolucao-mensal") {
        return Promise.resolve(jsonResponse(consolidadaFixture));
      }
      if (url === "/investimentos/1/evolucao-mensal") {
        return Promise.resolve(jsonResponse(porInvestimentoFixture));
      }
      const base = baseHandlers(url);
      if (base) return base;
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);

    // Espera por um rótulo garantidamente único (o nome do investimento
    // aparece 2x nesta tela quando o ranking carrega: label do tile de
    // entrada + linha do ranking — findByText com texto duplicado é
    // instável, por isso o ponto de sincronização é o rótulo do KPI).
    expect(await screen.findByText("Patrimônio Investido")).toBeInTheDocument();
    expect(screen.getByText("R$ 11.000,00")).toBeInTheDocument();
    expect(screen.getByText("Rendimento do Mês")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("Aportes")).toBeInTheDocument();
    expect(screen.getByText("R$ 600,00")).toBeInTheDocument();
    expect(screen.getByText("Resgates")).toBeInTheDocument();
    expect(screen.getByText("R$ 100,00")).toBeInTheDocument();

    expect(screen.getByText("Desempenho no mês")).toBeInTheDocument();
    // "Reserva de emergência" aparece 2x (label do tile de entrada + nome na
    // linha do ranking) — localiza especificamente a que está numa <tr>.
    const nomeOcorrencias = screen.getAllByText("Reserva de emergência");
    const rankingRow = nomeOcorrencias.map((el) => el.closest("tr")).find((tr) => tr !== null);
    expect(rankingRow).not.toBeUndefined();
  });

  it("shows a placeholder instead of the ranking table when no investimento has a snapshot for the filtered month", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/investimentos") return Promise.resolve(jsonResponse([INVESTIMENTO_FIXTURE]));
      const base = baseHandlers(url);
      if (base) return base;
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<InvestimentosPage />);
    await screen.findByText("Reserva de emergência");

    expect(
      await screen.findByText("Nenhum investimento com snapshot neste mês ainda.")
    ).toBeInTheDocument();
  });
});
