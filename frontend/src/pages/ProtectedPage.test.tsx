import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "../api/auth";
import { ProtectedPage } from "./ProtectedPage";

const USER: CurrentUser = {
  id: 1,
  email: "alice@example.com",
  name: "Alice",
  salario_competencia_cutoff_dia: 25,
  created_at: "2026-01-01T00:00:00Z",
};

const SUMMARY_FIXTURE = {
  receita: "0",
  despesa: "0",
  saldo: "0",
  patrimonio: "0",
  ativos: "0",
  passivos: "0",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Cobre indiscriminadamente toda rota GET usada pelas telas navegáveis por
// ProtectedPage — o objetivo deste teste é a navegação em si (nav sem
// Início, com Passivos, ordem final), não o conteúdo de cada tela.
function catchAllFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/dashboards/summary"))
      return Promise.resolve(jsonResponse(SUMMARY_FIXTURE));
    if (url.startsWith("/dashboards/")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/category-groups")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/subcategories")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/assets")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/liabilities")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/orcamentos")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/categorization/transactions")) {
      return Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, page_size: 20 }));
    }
    if (url.startsWith("/pluggy/")) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse([]));
  });
}

function renderProtectedPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProtectedPage user={USER} />
    </QueryClientProvider>
  );
}

describe("ProtectedPage navigation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no separate Início tab, Dashboards is the initial tab, and Passivos exists", async () => {
    vi.stubGlobal("fetch", catchAllFetchMock());

    renderProtectedPage();

    expect(screen.queryByRole("button", { name: "Início" })).not.toBeInTheDocument();
    const dashboardsTab = screen.getByRole("button", { name: "Dashboards" });
    expect(dashboardsTab).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Passivos" })).toBeInTheDocument();
  });

  it("orders the nav as Dashboards, Categorizar, Ativos, Investimentos, Passivos, Natureza, Orçamento, Configurações (8 abas, sem Categorias)", () => {
    vi.stubGlobal("fetch", catchAllFetchMock());

    renderProtectedPage();

    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const labels = within(nav)
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(labels).toEqual([
      "Dashboards",
      "Categorizar",
      "Ativos",
      "Investimentos",
      "Passivos",
      "Natureza",
      "Orçamento",
      "Configurações",
    ]);
  });

  it("switches to the Configurações tab and renders ConfiguracoesPage", async () => {
    vi.stubGlobal("fetch", catchAllFetchMock());

    renderProtectedPage();

    await userEvent.click(screen.getByRole("button", { name: "Configurações" }));

    expect(await screen.findByRole("heading", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar contas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurações" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("switches to the Passivos tab and renders LiabilitiesPage", async () => {
    vi.stubGlobal("fetch", catchAllFetchMock());

    renderProtectedPage();

    await userEvent.click(screen.getByRole("button", { name: "Passivos" }));

    // LiabilitiesPage (Sprint 36, Analyst Console) não renderiza um <h2> de
    // título de página — mesmo precedente de NaturezaPage/CategorizationReviewPage
    // (Sprint 35): a aba já rotula a tela na sidebar.
    expect(await screen.findByRole("button", { name: "Novo passivo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Passivos" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("switches to the Natureza tab and renders NaturezaPage", async () => {
    vi.stubGlobal("fetch", catchAllFetchMock());

    renderProtectedPage();

    await userEvent.click(screen.getByRole("button", { name: "Natureza" }));

    expect(await screen.findByText("Classificar subcategorias")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Natureza" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("switches to the Orçamento tab and renders OrcamentoPage", async () => {
    vi.stubGlobal("fetch", catchAllFetchMock());

    renderProtectedPage();

    await userEvent.click(screen.getByRole("button", { name: "Orçamento" }));

    // OrcamentoPage (Sprint 36, Analyst Console) não renderiza um <h2> de
    // título de página — mesmo precedente de NaturezaPage/CategorizationReviewPage
    // (Sprint 35): a aba já rotula a tela na sidebar.
    expect(await screen.findByRole("button", { name: "Novo orçamento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Orçamento" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("has no separate Categorias tab in the nav", () => {
    vi.stubGlobal("fetch", catchAllFetchMock());

    renderProtectedPage();

    expect(screen.queryByRole("button", { name: "Categorias" })).not.toBeInTheDocument();
  });
});
