import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchDashboardPorCategoria,
  fetchDashboardPorMeioPagamento,
  fetchDashboardPorNatureza,
  fetchDashboardPorNaturezaTendencia,
  fetchDashboardProjecao,
  fetchDashboardSummary,
} from "./dashboards";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("dashboards api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchDashboardSummary requests /dashboards/summary without filters when omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardSummary();

    expect(fetchMock.mock.calls[0][0]).toBe("/dashboards/summary");
  });

  it("fetchDashboardSummary appends ano/mes as query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardSummary({ ano: 2026, mes: 1 });

    expect(fetchMock.mock.calls[0][0]).toBe("/dashboards/summary?ano=2026&mes=1");
  });

  it("fetchDashboardPorCategoria includes tipo and filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardPorCategoria("debito", { ano: 2026, mes: 1 });

    expect(fetchMock.mock.calls[0][0]).toBe("/dashboards/por-categoria?tipo=debito&ano=2026&mes=1");
  });

  it("fetchDashboardPorMeioPagamento includes categoria_id when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardPorMeioPagamento("debito", { ano: 2026, mes: 1, categoriaId: 5 });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/dashboards/por-meio-pagamento?tipo=debito&ano=2026&mes=1&categoria_id=5"
    );
  });

  it("fetchDashboardPorMeioPagamento omits categoria_id when absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardPorMeioPagamento("credito", { ano: 2026 });

    expect(fetchMock.mock.calls[0][0]).toBe("/dashboards/por-meio-pagamento?tipo=credito&ano=2026");
  });

  it("fetchDashboardPorNatureza includes tipo and filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardPorNatureza("debito", { ano: 2026, mes: 1 });

    expect(fetchMock.mock.calls[0][0]).toBe("/dashboards/por-natureza?tipo=debito&ano=2026&mes=1");
  });

  it("fetchDashboardPorNaturezaTendencia includes tipo, periodo and meses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardPorNaturezaTendencia("credito", { ano: 2026, mes: 1, meses: 3 });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/dashboards/por-natureza/tendencia?tipo=credito&ano=2026&mes=1&meses=3"
    );
  });

  it("fetchDashboardProjecao includes ano/mes and meses_futuros", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardProjecao({ ano: 2026, mes: 1, mesesFuturos: 6 });

    expect(fetchMock.mock.calls[0][0]).toBe("/dashboards/projecao?ano=2026&mes=1&meses_futuros=6");
  });

  it("fetchDashboardProjecao includes janela_media when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchDashboardProjecao({ ano: 2026, mes: 1, mesesFuturos: 3, janelaMedia: 6 });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/dashboards/projecao?ano=2026&mes=1&meses_futuros=3&janela_media=6"
    );
  });
});
