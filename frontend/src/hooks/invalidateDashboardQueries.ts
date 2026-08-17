import type { QueryClient } from "@tanstack/react-query";

function invalidateAllDashboardQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === "string" &&
      (query.queryKey[0].startsWith("dashboard") || query.queryKey[0] === "saldoPorConta"),
  });
}

// Edição de transação (descrição/categoria/ativo/passivo) pode acontecer a
// partir da tela de Categorização OU do drill-down do Dashboard/Ativos —
// invalida as duas frentes pra a tela de origem sempre refletir a mudança
// sem reload manual (F5).
export function invalidateAfterTransactionEdit(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
  queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
  // Categoria/investimento de uma transação pode ser Aporte/Resgate, que
  // entra direto no cálculo de rendimento_estimado — sem isso o card do
  // investimento ficaria com dado velho até um reload manual.
  queryClient.invalidateQueries({ queryKey: ["investimentoEvolucao"] });
  invalidateAllDashboardQueries(queryClient);
}

// Edição de `natureza` de subcategoria (tela Natureza) muda o agrupamento
// por natureza em toda parte, sem tocar em nenhuma transação individual —
// só precisa invalidar a lista de subcategorias e os dashboards.
export function invalidateAfterSubcategoryEdit(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["subcategories"] });
  invalidateAllDashboardQueries(queryClient);
}
