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
  [2026, 9],
  [2026, 10],
  [2026, 11],
  [2026, 12],
  [2027, 1],
  [2027, 2],
  [2027, 3],
  [2027, 4],
  [2027, 5],
  [2027, 6],
];
// Completa até 16 colunas.
while (PERIODO.length < 16) {
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

const GRADE_FIXTURE = {
  periodo: PERIODO,
  subcategorias: [
    {
      subcategory_id: 10,
      subcategory_nome: "Mercado",
      group_id: 1,
      group_nome: "Alimentação",
      tipo: "debito",
      celulas: buildCelulas({ realizado_parcial: "150.00", status: "alerta" }),
    },
  ],
  itens: [],
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

function routedFetchMock(overrides?: { itens?: unknown[] }) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.startsWith("/planejamento/grade")) {
      return Promise.resolve(jsonResponse(GRADE_FIXTURE));
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

  it("renders the grade with 16 month columns", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<PlanejamentoPage />);

    await screen.findByText("Mercado");
    const headerCells = container.querySelectorAll("table.planejamento-grade thead th");
    // 1 coluna "Subcategoria" + 16 colunas de mês.
    expect(headerCells.length).toBe(17);
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
