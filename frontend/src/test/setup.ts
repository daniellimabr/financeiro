import "@testing-library/jest-dom/vitest";

// jsdom não implementa ResizeObserver; Recharts (ResponsiveContainer) exige
// no ambiente de testes.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
