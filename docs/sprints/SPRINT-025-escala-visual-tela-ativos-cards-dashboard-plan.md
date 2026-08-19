# SPRINT-025: Escala visual, tela Ativos e cards Ativos/Passivos/Patrimônio/Saldo Acumulado — Plano

- **PRD(s):** [PRD-025-escala-visual-tela-ativos-cards-dashboard.md](../prd/PRD-025-escala-visual-tela-ativos-cards-dashboard.md)
- **Data do plano:** 2026-08-19

## Objetivo da sprint

O app fica visualmente mais compacto (equivalente a zoom 80%), a tela Ativos ganha um drilldown de
extrato de verdade (accordion, sem toggle irrelevante) e os cards Ativos/Passivos/Patrimônio/Saldo
Acumulado do Dashboard ficam consistentes entre si: mesmo padrão de drilldown, mesma convenção de
percentual do total, cor distinta por item onde faz sentido.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Bloco 0: investigar via SSH (VM de dev) a transação "encerramento de dívida"/"Receitas-Estornos"; confirmar achado e decisão com o CEO antes de codar | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 2 | Reduzir `--text-2xs`..`--text-2xl` e `--space-1`..`--space-7` em ~20% em `index.css`; QA visual em várias telas pra confirmar legibilidade | Sonnet: implementação | `frontend/src/index.css` (tokens, linhas 117-132) |
| 3 | `AssetsPage.tsx`: remover `RegimeToggle`/estado `regime`, fixar competência | Sonnet: implementação | `frontend/src/pages/AssetsPage.tsx` (linhas 13, 52, 177, 347, 386-397) |
| 4 | `AssetDrilldown`: trocar `<TransactionsTable>` por accordion Categoria→Subcategoria→Transação escopado a um ativo (reaproveitar lógica de agrupamento do funil de Dashboard) | Sonnet: implementação | `AssetsPage.tsx` (382-422), `frontend/src/pages/DashboardsPage.tsx` (`GrupoAccordion`/`SubcategoriaAccordion`) |
| 5 | Aplicar o fix decidido no Bloco 0 (recategorizar transação via API existente, ou ajustar filtro do drilldown por ativo) | Sonnet: implementação | depende do achado da tarefa 1 |
| 6 | Card Ativos (Dashboard): nova seção "Valor atual por Ativo" (`AssetsValorAtualList`) como 1ª; "Despesas por Ativo" (título novo no accordion de gasto existente) como última; remover "Saldo por conta" | Sonnet: implementação | `DashboardsPage.tsx` (`drill.kind === "ativos"`, linhas ~397-427) |
| 7 | `InvestimentosValorAtualList`: cor única (`var(--accent)`) vira cor por investimento (`buildColorIndexFromIds`, mesmo padrão de `AtivosAccordion`) | Sonnet: implementação | `DashboardsPage.tsx` (linhas ~1017-1054), `frontend/src/utils/categoryColors.ts` |
| 8 | Card Passivos: `LiabilitiesValorAtualList` troca `<table>` por `dash-accordion`/`Row` (barra+%, sem expandir) | Sonnet: implementação | `DashboardsPage.tsx` (linhas ~1137-1178) |
| 9 | Percentual do total em `AssetsValorAtualList`, `LiabilitiesValorAtualList` (já migrada na tarefa 8) e `InvestimentoHoldingsList` — mesmo cálculo/format do funil Despesa/Receita | Sonnet: implementação | `DashboardsPage.tsx` (`GrupoAccordion`, cálculo de `percentual`/`formatPercent` linhas ~666-736) |
| 10 | Card Saldo Acumulado: adicionar frase da fórmula (Saldo do mês anterior + Receita − Despesa) no tile ou início do drilldown | Sonnet: implementação | `DashboardsPage.tsx` (tile linhas ~345-370, `SaldoAcumuladoMemoriaCalculo`) |
| 11 | QA visual real na VM de dev — `scripts/browser-check/check-sprint25.mjs` (novo): confirmar ausência do disclaimer de Patrimônio, nova escala visual, ordem/títulos dos drilldowns de Ativos, cor por investimento, % em toda lista de valor atual, desktop+mobile | Sonnet: implementação | [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) |
| 12 | Atualizar `docs/dashboards-guia-cards.md` (ordem/títulos novos dos drilldowns de Ativos/Passivos) | Haiku: doc-updater | `docs/dashboards-guia-cards.md` |
| 13 | Relatório de sprint | Sonnet: implementação | `templates/SPRINT-report-template.md` |

## Testes previstos

Unitários/componente (frontend): accordion de extrato por ativo agrupando corretamente por
categoria/subcategoria; cor por investimento sem colisão; cálculo de percentual do total em cada
lista de valor atual (incl. denominador zero); ordem/títulos das seções do card Ativos. Backend:
só se o Bloco 0 exigir mudança de filtro no endpoint `por-ativo` (a confirmar) — caso contrário,
sem mudança de backend nesta sprint.

## Impacto no roadmap

Cross-epic, sem épico prévio (mesmo padrão das Sprints 16-24). Primeira de 3 sprints desta sessão
de planejamento (PRD-025/026/027) — independente entre si, podem rodar em qualquer ordem, mas a
divisão temática (visual/dados → interatividade → feature nova) segue a ordem natural de risco
crescente.

## Riscos / dependências

- O Bloco 0 pode revelar que o caso "Receitas/Estornos" é mais amplo que uma transação isolada
  (mesmo padrão do achado NuTag na Sprint 10 e do achado de baseline na Sprint 22) — se assim for,
  o escopo do fix é decidido com o CEO antes de implementar, pode crescer além do PRD.
- Reduzir os tokens de espaçamento/fonte em ~20% é uma mudança visual ampla — QA real (não só
  screenshot de uma tela) é obrigatório antes de fechar, para achar quebras de layout em telas
  menos visitadas (ex. formulários de Ativos/Passivos, diálogos).
- `SaldoPorContaList` fica sem nenhum call site depois da tarefa 6 (verificar se é usada em outro
  lugar do app antes de decidir se o componente inteiro é removido ou fica órfão).
