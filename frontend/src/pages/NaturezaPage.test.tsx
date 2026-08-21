import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NaturezaPage } from "./NaturezaPage";

const GROUPS_FIXTURE = [
  {
    id: 1,
    nome: "Moradia",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    nome: "Alimentação",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

let subcategoriesFixture = [
  {
    id: 10,
    group_id: 1,
    nome: "Aluguel",
    natureza: "fixa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 11,
    group_id: 2,
    nome: "Mercado",
    natureza: "variavel",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 12,
    group_id: 2,
    nome: "Restaurante",
    natureza: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 13,
    group_id: 1,
    nome: "Condomínio",
    natureza: "eventual",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const CATEGORIA_FIXTURE = [
  {
    group_id: 1,
    group_nome: "Moradia",
    subcategory_id: 10,
    subcategory_nome: "Aluguel",
    total: "1000.00",
    percentual: "0",
  },
  {
    group_id: 2,
    group_nome: "Alimentação",
    subcategory_id: 11,
    subcategory_nome: "Mercado",
    total: "300.00",
    percentual: "0",
  },
  {
    group_id: 2,
    group_nome: "Alimentação",
    subcategory_id: 12,
    subcategory_nome: "Restaurante",
    total: "200.00",
    percentual: "0",
  },
  {
    group_id: 1,
    group_nome: "Moradia",
    subcategory_id: 13,
    subcategory_nome: "Condomínio",
    total: "150.00",
    percentual: "0",
  },
];

const NATUREZA_FIXTURE_DEBITO = [
  { natureza: "fixa", total: "1000.00", percentual: "66.67" },
  { natureza: "variavel", total: "300.00", percentual: "20.00" },
  { natureza: "eventual", total: "200.00", percentual: "13.33" },
];

const NATUREZA_FIXTURE_CREDITO = [
  { natureza: "fixa", total: "0", percentual: "0" },
  { natureza: "variavel", total: "0", percentual: "0" },
  { natureza: "eventual", total: "5000.00", percentual: "100.00" },
];

const TRANSACAO_FIXTURE = {
  id: 1,
  account_id: 1,
  user_id: 1,
  pluggy_transaction_id: "tx-1",
  descricao: "Imobiliária Alfa",
  descricao_usuario: null,
  descricao_sugerida: null,
  valor: "-1000.00",
  tipo: "debito",
  data: "2026-01-05",
  data_competencia: "2026-01-05",
  data_editada_manualmente: false,
  subcategory_id: 10,
  subcategoria_sugerida_id: null,
  categoria_pluggy: null,
  status: "efetivada",
  account_tipo: "corrente",
  asset_id: null,
  asset_sugerido_id: null,
  created_at: "2026-01-05T00:00:00Z",
  updated_at: "2026-01-05T00:00:00Z",
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
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.startsWith("/dashboards/por-natureza/tendencia"))
      return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/dashboards/por-natureza")) {
      const tipo = url.includes("tipo=credito") ? "credito" : "debito";
      return Promise.resolve(
        jsonResponse(tipo === "credito" ? NATUREZA_FIXTURE_CREDITO : NATUREZA_FIXTURE_DEBITO)
      );
    }
    if (url.startsWith("/dashboards/por-categoria"))
      return Promise.resolve(jsonResponse(CATEGORIA_FIXTURE));
    if (url.startsWith("/category-groups")) return Promise.resolve(jsonResponse(GROUPS_FIXTURE));
    if (url === "/subcategories" && method === "GET")
      return Promise.resolve(jsonResponse(subcategoriesFixture));
    if (url.startsWith("/subcategories/") && method === "PUT") {
      const id = Number(url.split("/").pop());
      const body = JSON.parse(init?.body as string);
      subcategoriesFixture = subcategoriesFixture.map((sub) =>
        sub.id === id ? { ...sub, ...body } : sub
      );
      return Promise.resolve(jsonResponse(subcategoriesFixture.find((sub) => sub.id === id)));
    }
    if (url.startsWith("/pluggy/transactions"))
      return Promise.resolve(jsonResponse([TRANSACAO_FIXTURE]));
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
}

describe("NaturezaPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    subcategoriesFixture = [
      {
        id: 10,
        group_id: 1,
        nome: "Aluguel",
        natureza: "fixa",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 11,
        group_id: 2,
        nome: "Mercado",
        natureza: "variavel",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 12,
        group_id: 2,
        nome: "Restaurante",
        natureza: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: 13,
        group_id: 1,
        nome: "Condomínio",
        natureza: "eventual",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
  });

  it("renders the 3 natureza cards with totals and percentuais from mocked data", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");
    const summary = within(container.querySelector(".ac-kpi-row--3") as HTMLElement);

    expect(summary.getByText("Fixo recorrente")).toBeInTheDocument();
    expect(summary.getByText("Variável recorrente")).toBeInTheDocument();
    expect(summary.getByText("Eventual")).toBeInTheDocument();
    expect(summary.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(summary.getByText("R$ 300,00")).toBeInTheDocument();
    expect(summary.getByText("R$ 200,00")).toBeInTheDocument();
  });

  it("clicking a card opens the drilldown with the Categoria level first, then Subcategoria, including unclassified as eventual", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");
    const summary = within(container.querySelector(".ac-kpi-row--3") as HTMLElement);

    await userEvent.click(summary.getByRole("button", { name: /Fixo recorrente/ }));
    const funnel = () => within(container.querySelector(".dash-funnel") as HTMLElement);
    expect(await funnel().findByText("Moradia")).toBeInTheDocument();
    expect(funnel().queryByText("Aluguel")).not.toBeInTheDocument();

    await userEvent.click(
      (await funnel().findByText("Moradia")).closest("button.dash-row") as HTMLElement
    );
    expect(await funnel().findByText("Aluguel")).toBeInTheDocument();

    await userEvent.click(summary.getByRole("button", { name: /Eventual/ }));
    // Restaurante tem natureza=null no fixture — deve cair no funil de eventual,
    // agrupado sob "Alimentação".
    await userEvent.click(
      (await funnel().findByText("Alimentação")).closest("button.dash-row") as HTMLElement
    );
    expect(await funnel().findByText("Restaurante")).toBeInTheDocument();
  });

  it("Categoria percentuais somam 100% do total da natureza, e mais de uma categoria pode ficar expandida ao mesmo tempo", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");
    const summary = within(container.querySelector(".ac-kpi-row--3") as HTMLElement);
    const funnel = () => within(container.querySelector(".dash-funnel") as HTMLElement);

    await userEvent.click(summary.getByRole("button", { name: /Eventual/ }));
    // Eventual tem 2 grupos: Alimentação (Restaurante, 200) e Moradia
    // (Condomínio, 150) — total 350, percentuais 57.1%/42.9%.
    expect(await funnel().findByText("Alimentação")).toBeInTheDocument();
    expect(funnel().getByText("Moradia")).toBeInTheDocument();
    expect(funnel().getByText("57.1%")).toBeInTheDocument();
    expect(funnel().getByText("42.9%")).toBeInTheDocument();

    await userEvent.click(
      funnel().getByText("Alimentação").closest("button.dash-row") as HTMLElement
    );
    await userEvent.click(funnel().getByText("Moradia").closest("button.dash-row") as HTMLElement);

    // Ambos os grupos seguem abertos ao mesmo tempo (sanfona multi-nível) —
    // cada um tem 1 única subcategoria, então 100% do total do grupo.
    expect(await funnel().findByText("Restaurante")).toBeInTheDocument();
    expect(funnel().getByText("Condomínio")).toBeInTheDocument();
    expect(funnel().getAllByText("100.0%")).toHaveLength(2);
  });

  it("clicking a subcategoria in the drilldown shows its transactions", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");
    const summary = within(container.querySelector(".ac-kpi-row--3") as HTMLElement);

    await userEvent.click(summary.getByRole("button", { name: /Fixo recorrente/ }));
    const funnel = within(container.querySelector(".dash-funnel") as HTMLElement);
    const grupoRow = (await funnel.findByText("Moradia")).closest("button.dash-row") as HTMLElement;
    await userEvent.click(grupoRow);
    const subcategoriaRow = (await funnel.findByText("Aluguel")).closest(
      "button.dash-row"
    ) as HTMLElement;
    await userEvent.click(subcategoriaRow);

    expect(await screen.findByText("Imobiliária Alfa")).toBeInTheDocument();
  });

  it("renders the classification table grouped by category, defaulting null natureza to eventual", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<NaturezaPage />);
    const aluguelSelect = (await screen.findByLabelText(
      "Natureza de Aluguel"
    )) as HTMLSelectElement;

    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(aluguelSelect.value).toBe("fixa");
    const restauranteSelect = screen.getByLabelText("Natureza de Restaurante") as HTMLSelectElement;
    expect(restauranteSelect.value).toBe("eventual");
  });

  it("changing a row's natureza saves via PUT /subcategories/{id} with the full payload and refetches dashboards", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<NaturezaPage />);
    await screen.findByLabelText("Natureza de Restaurante");

    const callsBefore = fetchMock.mock.calls.filter((c) =>
      String(c[0]).startsWith("/dashboards/por-natureza")
    ).length;

    const restauranteSelect = screen.getByLabelText("Natureza de Restaurante");
    await userEvent.selectOptions(restauranteSelect, "fixa");

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => String(c[0]) === "/subcategories/12" && (c[1] as RequestInit)?.method === "PUT"
      );
      expect(call).toBeDefined();
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toEqual({ group_id: 2, nome: "Restaurante", natureza: "fixa" });
    });

    await waitFor(() => {
      const callsAfter = fetchMock.mock.calls.filter((c) =>
        String(c[0]).startsWith("/dashboards/por-natureza")
      ).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });

  it("classification table sorts by Categoria/Subcategoria, keeping rowSpan grouping intact", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("Moradia");

    // default: Categoria já ativa asc (mesmo padrão das outras tabelas, que
    // sempre têm uma coluna ordenada por padrão) — ordem alfabética. Só a
    // primeira linha de cada grupo tem a célula de Categoria (rowSpan).
    const gruposEmOrdem = () =>
      Array.from(document.querySelectorAll(".subcategory-group-table tbody td[rowspan]")).map(
        (td) => td.textContent
      );
    expect(gruposEmOrdem()).toEqual(["Alimentação", "Moradia"]);

    await userEvent.click(screen.getByRole("button", { name: "Categoria" }));
    expect(gruposEmOrdem()).toEqual(["Moradia", "Alimentação"]);

    await userEvent.click(screen.getByRole("button", { name: "Categoria" }));
    expect(gruposEmOrdem()).toEqual(["Alimentação", "Moradia"]);

    // Subcategoria: reordena as linhas dentro de cada grupo, sem sort de
    // grupo ativo a ordem dos grupos volta à ordem original (Moradia antes
    // de Alimentação — mesma ordem de /category-groups no fixture).
    await userEvent.click(screen.getByRole("button", { name: "Subcategoria" }));
    expect(gruposEmOrdem()).toEqual(["Moradia", "Alimentação"]);

    const primeirasDuasLinhas = () =>
      Array.from(document.querySelectorAll(".subcategory-group-table tbody tr"))
        .slice(0, 2)
        .map((row) => row.textContent);
    expect(primeirasDuasLinhas()[0]).toContain("Aluguel");
    expect(primeirasDuasLinhas()[1]).toContain("Condomínio");

    await userEvent.click(screen.getByRole("button", { name: "Subcategoria" }));
    expect(primeirasDuasLinhas()[0]).toContain("Condomínio");
    expect(primeirasDuasLinhas()[1]).toContain("Aluguel");
  });

  it("toggling despesa/receita refetches por-natureza with the selected tipo", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");

    await userEvent.click(screen.getByRole("button", { name: "Receita" }));

    expect(await screen.findByText("R$ 5.000,00")).toBeInTheDocument();
  });
});
