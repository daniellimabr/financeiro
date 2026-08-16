import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjecaoPage } from "./ProjecaoPage";

const TENDENCIA_FIXTURE = [
  { ano: 2025, mes: 9, receita: "1900.00", despesa: "850.00", saldo: "1050.00" },
  { ano: 2025, mes: 10, receita: "1950.00", despesa: "880.00", saldo: "1070.00" },
  { ano: 2025, mes: 11, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2025, mes: 12, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2026, mes: 1, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2026, mes: 2, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
];

const PROJECAO_FIXTURE = [
  { ano: 2026, mes: 3, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2026, mes: 4, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2026, mes: 5, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2026, mes: 6, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2026, mes: 7, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
  { ano: 2026, mes: 8, receita: "2000.00", despesa: "900.00", saldo: "1100.00" },
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
    if (url.startsWith("/dashboards/tendencia"))
      return Promise.resolve(jsonResponse(TENDENCIA_FIXTURE));
    if (url.startsWith("/dashboards/projecao"))
      return Promise.resolve(jsonResponse(PROJECAO_FIXTURE));
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe("ProjecaoPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the 3 cards with the average computed from the projecao fixture", async () => {
    vi.stubGlobal("fetch", routedFetchMock());

    const { container } = renderWithQueryClient(<ProjecaoPage />);
    await screen.findByText(/Linha sólida/);
    const summary = within(container.querySelector(".dash-summary") as HTMLElement);

    expect(summary.getByText("R$ 2.000,00")).toBeInTheDocument();
    expect(summary.getByText("R$ 900,00")).toBeInTheDocument();
    expect(summary.getByText("R$ 1.100,00")).toBeInTheDocument();
  });

  it("adding a mensal hipotetica recalculates the cards without an extra network call", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ProjecaoPage />);
    await screen.findByText(/Linha sólida/);
    const callsAfterLoad = fetchMock.mock.calls.length;

    await userEvent.type(screen.getByLabelText("Nome da hipotética"), "Freelance");
    await userEvent.type(screen.getByLabelText("Valor da hipotética"), "300");
    await userEvent.selectOptions(screen.getByLabelText("Tipo da hipotética"), "receita");
    await userEvent.selectOptions(screen.getByLabelText("Frequência da hipotética"), "mensal");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    expect(await screen.findByText("R$ 2.300,00")).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
  });

  it("adding a unica hipotetica only affects the target month, and removing it restores the original values", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ProjecaoPage />);
    await screen.findByText(/Linha sólida/);
    const callsAfterLoad = fetchMock.mock.calls.length;

    await userEvent.type(screen.getByLabelText("Nome da hipotética"), "Carro");
    await userEvent.type(screen.getByLabelText("Valor da hipotética"), "12000");
    await userEvent.selectOptions(screen.getByLabelText("Mês-alvo da hipotética"), "2026-4");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));

    // Média mensal de despesa sobe: (900*5 + 12900)/6 = 2900.00
    expect(await screen.findByText("R$ 2.900,00")).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);

    await userEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(await screen.findByText("R$ 900,00")).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsAfterLoad);
  });

  it("changing the horizonte triggers a new query", async () => {
    const fetchMock = routedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<ProjecaoPage />);
    await screen.findByText(/Linha sólida/);
    const callsAfterLoad = fetchMock.mock.calls.length;

    await userEvent.selectOptions(screen.getByLabelText("Horizonte de projeção"), "3");

    await screen.findByText(/Linha sólida/);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterLoad);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("meses_futuros=3"))).toBe(
      true
    );
  });
});
