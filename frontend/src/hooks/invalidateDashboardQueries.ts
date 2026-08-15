import type { QueryClient } from "@tanstack/react-query";

// Edição de transação (descrição/categoria/ativo/passivo) pode acontecer a
// partir da tela de Categorização OU do drill-down do Dashboard/Ativos —
// invalida as duas frentes pra a tela de origem sempre refletir a mudança
// sem reload manual (F5).
export function invalidateAfterTransactionEdit(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["categorizationTransactions"] });
  queryClient.invalidateQueries({ queryKey: ["pluggyTransactions"] });
  queryClient.invalidateQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === "string" &&
      (query.queryKey[0].startsWith("dashboard") || query.queryKey[0] === "saldoPorConta"),
  });
}
