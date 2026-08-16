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
    ];
  });

  it("renders the 3 natureza cards with totals and percentuais from mocked data", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");
    const summary = within(container.querySelector(".dash-summary") as HTMLElement);

    expect(summary.getByText("Fixo recorrente")).toBeInTheDocument();
    expect(summary.getByText("Variável recorrente")).toBeInTheDocument();
    expect(summary.getByText("Custo eventual")).toBeInTheDocument();
    expect(summary.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(summary.getByText("R$ 300,00")).toBeInTheDocument();
    expect(summary.getByText("R$ 200,00")).toBeInTheDocument();
  });

  it("clicking a card opens the drilldown with subcategories of that natureza, including unclassified as eventual", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");
    const summary = within(container.querySelector(".dash-summary") as HTMLElement);

    await userEvent.click(summary.getByRole("button", { name: /Fixo recorrente/ }));
    const funnel = () => within(container.querySelector(".dash-funnel") as HTMLElement);
    expect(await funnel().findByText("Aluguel")).toBeInTheDocument();

    await userEvent.click(summary.getByRole("button", { name: /Custo eventual/ }));
    // Restaurante tem natureza=null no fixture — deve cair no funil de eventual.
    expect(await funnel().findByText("Restaurante")).toBeInTheDocument();
  });

  it("clicking a subcategoria in the drilldown shows its transactions", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");
    const summary = within(container.querySelector(".dash-summary") as HTMLElement);

    await userEvent.click(summary.getByRole("button", { name: /Fixo recorrente/ }));
    const funnel = within(container.querySelector(".dash-funnel") as HTMLElement);
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

  it("toggling despesa/receita refetches por-natureza with the selected tipo", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    renderWithQueryClient(<NaturezaPage />);
    await screen.findByText("R$ 1.000,00");

    await userEvent.click(screen.getByRole("button", { name: "Receita" }));

    expect(await screen.findByText("R$ 5.000,00")).toBeInTheDocument();
  });
});
