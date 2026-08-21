// Rollover de mês/ano — extraído de DashboardsPage.tsx (Sprint 34) pra
// componente compartilhado (Sprint 36, PRD-036b): Investimentos é a
// segunda tela a precisar de navegação por mês, então MonthNav e a
// matemática de rollover que ele usa saem do arquivo local do Dashboard.

// Rollover de ano incluído — dezembro do ano anterior é um "mês anterior"
// válido para todo filtro exceto jan/2026 (início do registro histórico,
// tratado à parte no clique do card "Saldo Anterior" do Dashboard).
export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

// Inverso de mesAnterior — navegação pro mês seguinte (fronteira tratada à
// parte por quem chama: nenhuma tela deve navegar além do mês corrente real).
export function mesSeguinte(ano: number, mes: number): { ano: number; mes: number } {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

export function isMesAtual(ano: number, mes: number): boolean {
  const hoje = new Date();
  return ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
}
