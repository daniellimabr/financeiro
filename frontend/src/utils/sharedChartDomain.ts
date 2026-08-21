// Domínio Y compartilhado entre duas (ou mais) séries de um comparativo em
// pequenos múltiplos (Sprint 34, "Analyst Console") — nunca cada gráfico
// normalizado no seu próprio mínimo/máximo, senão a comparação visual entre
// Receita e Despesa mentiria (duas barras do mesmo tamanho podem representar
// valores bem diferentes se cada uma tem sua própria escala). Ver
// comparativo Receita vs. Despesa em DashboardsPage.tsx.
export function computeSharedDomain(series: number[][]): [number, number] {
  const values = series.flat();
  if (values.length === 0) return [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    // Série constante (ou um único ponto) — domínio de largura zero faria o
    // Recharts colapsar a linha numa altura só; abre uma folga mínima.
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}
