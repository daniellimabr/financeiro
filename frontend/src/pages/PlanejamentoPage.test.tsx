import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlanejamentoPage } from "./PlanejamentoPage";

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

const PERIODO: [number, number][] = [
  [2026, 5],
  [2026, 6],
  [2026, 7],
  [2026, 8],
];
// Completa até 10 colunas (3 histórico + 1 atual + 6 futuros).
while (PERIODO.length < 10) {
  const [ano, mes] = PERIODO[PERIODO.length - 1];
  PERIODO.push(mes === 12 ? [ano + 1, 1] : [ano, mes + 1]);
}

function celula(
  ano: number,
  mes: number,
  valor: string,
  origem: string,
  extra: Record<string, unknown> = {}
) {
  return {
    ano,
    mes,
    valor,
    origem,
    realizado_parcial: null,
    status: null,
    transacao_vinculada_id: null,
    ...extra,
  };
}

function buildCelulas(overridesAtIdx3?: Record<string, unknown>) {
  return PERIODO.map(([ano, mes], idx) => {
    if (idx < 3) return celula(ano, mes, "100.00", "realizado");
    if (idx === 3) return celula(ano, mes, "100.00", "sugerido", overridesAtIdx3 ?? {});
    return celula(ano, mes, "100.00", "sugerido");
  });
}

const MERCADO_CELULAS = buildCelulas({ realizado_parcial: "150.00", status: "alerta" });

// Total/saldo — mesma forma que o backend produz (origem sempre
// "confirmado", nenhum campo omitido) — só despesa (Mercado) contribui
// nesta fixture, receitas ficam zeradas.
const TOTAL_RECEITAS_CELULAS = PERIODO.map(([ano, mes], idx) =>
  idx === 3
    ? celula(ano, mes, "0.00", "confirmado", { realizado_parcial: "0.00", status: "dentro" })
    : celula(ano, mes, "0.00", "confirmado")
);
const TOTAL_DESPESAS_CELULAS = MERCADO_CELULAS.map((c) => ({ ...c, origem: "confirmado" }));
const SALDO_CELULAS = PERIODO.map(([ano, mes], idx) =>
  idx === 3
    ? celula(ano, mes, "-100.00", "confirmado", {
        realizado_parcial: "-150.00",
        status: "alerta",
      })
    : celula(ano, mes, "-100.00", "confirmado", { status: "alerta" })
);

const GRADE_FIXTURE = {
  periodo: PERIODO,
  subcategorias: [
    {
      subcategory_id: 10,
      subcategory_nome: "Mercado",
      group_id: 1,
      group_nome: "Alimentação",
      tipo: "debito",
      celulas: MERCADO_CELULAS,
    },
  ],
  itens: [],
  eventuais: [],
  total_despesas: TOTAL_DESPESAS_CELULAS,
  total_receitas: TOTAL_RECEITAS_CELULAS,
  saldo: SALDO_CELULAS,
};

const ITEM_HIPOTETICO = {
  id: 1,
  nome: "Presente",
  tipo: "debito",
  valor: "300.00",
  data_inicio: "2026-08-01",
  recorrente: false,
  data_fim: null,
  transacao_vinculada_id: null,
};

const ITEM_CUMPRIDO = {
  id: 2,
  nome: "Conserto",
  tipo: "debito",
  valor: "450.00",
  data_inicio: "2026-08-01",
  recorrente: false,
  data_fim: null,
  transacao_vinculada_id: 99,
};

const TRANSACAO_CANDIDATA = {
  id: 55,
  account_id: 1,
  user_id: 1,
  pluggy_transaction_id: "tx-55",
  descricao: "Loja Presentes LTDA",
  descricao_usuario: null,
  descricao_sugerida: null,
  valor: "-300.00",
  tipo: "debito",
  data: "2026-08-10",
  data_competencia: "2026-08-10",
  data_editada_manualmente: false,
  subcategory_id: null,
  subcategoria_sugerida_id: null,
  categoria_pluggy: null,
  status: "efetivada",
  account_tipo: "corrente",
  asset_id: null,
  asset_sugerido_id: null,
  investimento_id: null,
  investimento_sugerido_id: null,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
};

function routedFetchMock(overrides?: { itens?: unknown[] }, gradeOverrides?: { grade?: unknown }) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.startsWith("/planejamento/grade")) {
      return Promise.resolve(jsonResponse(gradeOverrides?.grade ?? GRADE_FIXTURE));
    }
    if (url.startsWith("/planejamento/itens") && method === "GET") {
      return Promise.resolve(jsonResponse(overrides?.itens ?? []));
    }
    if (url.startsWith("/planejamento/itens") && method === "POST" && url.endsWith("/itens")) {
      return Promise.resolve(jsonResponse({ ...ITEM_HIPOTETICO, id: 3 }, 201));
    }
    if (url.match(/\/planejamento\/itens\/\d+$/) && method === "PUT") {
      return Promise.resolve(jsonResponse(ITEM_HIPOTETICO));
    }
    if (url.match(/\/planejamento\/itens\/\d+$/) && method === "DELETE") {
      return Promise.resolve(jsonResponse(null, 204));
    }
    if (url.match(/\/planejamento\/itens\/\d+\/vincular$/) && method === "POST") {
      return Promise.resolve(jsonResponse({ ...ITEM_HIPOTETICO, transacao_vinculada_id: 55 }));
    }
    if (url.match(/\/planejamento\/itens\/\d+\/desvincular$/) && method === "POST") {
      return Promise.resolve(jsonResponse({ ...ITEM_CUMPRIDO, transacao_vinculada_id: null }));
    }
    if (url.startsWith("/planejamento/valores/") && method === "PUT") {
      return Promise.resolve(
        jsonResponse({ id: 1, subcategory_id: 10, ano: 2026, mes: 9, valor: "200.00" })
      );
    }
    if (url.startsWith("/planejamento/valores/") && method === "DELETE") {
      return Promise.resolve(jsonResponse(null, 204));
    }
    if (url.startsWith("/pluggy/transactions")) {
      return Promise.resolve(jsonResponse([TRANSACAO_CANDIDATA]));
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
}

describe("PlanejamentoPage", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the grade with 10 month columns (3 history + current + 6 future)", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<PlanejamentoPage />);

    await screen.findByText("Mercado");
    const headerCells = container.querySelectorAll("table.planejamento-grade thead th");
    // 1 coluna "Linha" + 10 colunas de mês.
    expect(headerCells.length).toBe(11);
  });

  it("renders Receitas before Despesas in the table", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Mercado");

    const sectionLabels = Array.from(container.querySelectorAll("tr.section-row td")).map(
      (el) => el.textContent
    );
    expect(sectionLabels).toEqual(["Receitas", "Despesas", "Itens planejados"]);
  });

  it("renders the Total despesas and Saldo simulado rows", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Mercado");

    expect(screen.getByText("Total despesas")).toBeInTheDocument();
    expect(screen.getByText("Total receitas")).toBeInTheDocument();
    expect(screen.getByText("Saldo simulado")).toBeInTheDocument();
    const saldoRow = screen.getByText("Saldo simulado").closest("tr");
    expect(saldoRow?.querySelector(".planejamento-val-saldo.alerta")).not.toBeNull();
  });

  it("renders the Eventual reminder row inside a section when present", async () => {
    const fixtureWithEventual = {
      ...GRADE_FIXTURE,
      eventuais: [
        {
          tipo: "debito",
          celulas: buildCelulas(),
        },
      ],
    };
    vi.stubGlobal("fetch", routedFetchMock(undefined, { grade: fixtureWithEventual }));

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Mercado");

    expect(screen.getByText("Eventual")).toBeInTheDocument();
    expect(screen.getByText("média histórica")).toBeInTheDocument();
  });

  it("shows a propagation hint when editing a still-suggested cell, not when editing a confirmed one", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Mercado");

    const row = screen.getByText("Mercado").closest("tr");
    if (!row) throw new Error("row not found");
    const rowButtons = within(row).getAllByRole("button");
    await userEvent.click(rowButtons[rowButtons.length - 1]);

    expect(screen.getByText(/Vale para os próximos 6 meses/)).toBeInTheDocument();
  });

  it("shows the alerta indicator on the current month when realizado exceeds the planned value", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Mercado");

    const alerta = container.querySelector(".planejamento-atual-realizado.alerta");
    expect(alerta).not.toBeNull();
    expect(alerta?.textContent).toContain("150,00");
  });

  it("confirms a sugerido future value inline", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Mercado");

    const row = screen.getByText("Mercado").closest("tr");
    if (!row) throw new Error("row not found");
    const rowButtons = within(row).getAllByRole("button");
    await userEvent.click(rowButtons[rowButtons.length - 1]);

    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await userEvent.type(input, "200");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]).startsWith("/planejamento/valores/10") &&
          (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
    });
  });

  it("creates a new item planejado via the inline form", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Mercado");

    await userEvent.click(screen.getByRole("button", { name: "Novo item" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Presente");
    const valorInputs = screen.getAllByLabelText("Valor");
    await userEvent.type(valorInputs[valorInputs.length - 1], "300");
    const dataInputs = screen.getAllByLabelText("Mês-alvo");
    await userEvent.type(dataInputs[dataInputs.length - 1], "2026-08-01");
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/planejamento/itens" && (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("edits and deletes an existing item planejado", async () => {
    const fetchMock = routedFetchMock({ itens: [ITEM_HIPOTETICO] });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Presente");

    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    const nomeInput = screen.getByLabelText("Nome");
    await userEvent.clear(nomeInput);
    await userEvent.type(nomeInput, "Presente de aniversário");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/planejamento/itens/1" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
    });

    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/planejamento/itens/1" && (c[1] as RequestInit)?.method === "DELETE"
      );
      expect(call).toBeDefined();
    });
  });

  it("links a planned item to a real transaction and then unlinks it", async () => {
    const fetchMock = routedFetchMock({ itens: [ITEM_HIPOTETICO] });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Presente");

    await userEvent.click(screen.getByRole("button", { name: "Vincular" }));
    await screen.findByText(/Loja Presentes LTDA/);
    const vincularButtons = screen.getAllByRole("button", { name: "Vincular" });
    await userEvent.click(vincularButtons[vincularButtons.length - 1]);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/planejamento/itens/1/vincular" &&
          (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });

  it("unlinks an already-linked item", async () => {
    const fetchMock = routedFetchMock({ itens: [ITEM_CUMPRIDO] });
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<PlanejamentoPage />);
    await screen.findByText("Conserto");

    await userEvent.click(screen.getByRole("button", { name: "Desvincular" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) =>
          String(c[0]) === "/planejamento/itens/2/desvincular" &&
          (c[1] as RequestInit)?.method === "POST"
      );
      expect(call).toBeDefined();
    });
  });
});
