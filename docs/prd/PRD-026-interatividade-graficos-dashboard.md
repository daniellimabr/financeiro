# PRD-026: Interatividade de gráficos (ampliar + hover + clique = filtro), sistema inteiro

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, 2ª de 3 sprints desta sessão de planejamento — ver
  PRD-025/PRD-027)
- **Sprint(s):** [SPRINT-026-interatividade-graficos-dashboard-plan.md](../sprints/SPRINT-026-interatividade-graficos-dashboard-plan.md)

## Problema

O CEO pediu, usando o Dashboard na prática: ampliar 3x a largura dos "mini gráficos" dentro dos
drilldowns, permitir que o mouse-over num ponto de dado mostre uma legenda (mês/ano + valor), e que
um clique nesse ponto filtre a tela pelo mês correspondente — com o mesmo comportamento replicado
em todo gráfico semelhante do sistema, incluindo os cards do Dashboard.

Investigação no código confirmou que o sistema tem 3 componentes de gráfico de linha distintos, em
estágios diferentes:

- `CardSparkline.tsx` e `TrendChart.tsx` (Recharts) já têm tooltip com mês/ano+valor no hover —
  falta só o clique-para-filtrar.
- `RowTrend` (`DashboardsPage.tsx`, SVG manual, 48×16px, `aria-hidden="true"`), usado por linha em
  `GrupoAccordion`/`SubcategoriaAccordion` (o "mini gráfico do drilldown" a que o CEO se refere),
  não tem tooltip nem interação nenhuma — precisa ser reconstruído.

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas na sessão de planejamento (2026-08-19):

1. O comportamento de mouse-over (legenda) + clique (filtra por mês, destacado no hover) é o
   mesmo em todos os gráficos de linha do sistema — não uma variação por tela.
2. Ambiguidade de design resolvida na sessão de execução (não nesta sessão de planejamento): como
   consolidar `CardSparkline`/`TrendChart`/o `RowTrend` reconstruído — provável caminho é um único
   componente parametrizado por tamanho/interatividade, já que os três compartilham Recharts.

## Escopo

### Incluído

- `RowTrend`: migra de SVG manual pra base Recharts (mesma família de `CardSparkline`/
  `TrendChart`), 3x mais largo (48px → ~144px), com tooltip mês/ano+valor no hover.
- `RowTrend`, `CardSparkline` e `TrendChart`: ganham clique num ponto de dado que filtra a tela
  pelo mês daquele ponto (destaque visual do ponto sob hover, antes do clique).
- Clique-para-filtrar conectado ao `PeriodFilter`/estado `ano`/`mes` de cada tela que usa esses
  componentes: `DashboardsPage.tsx` (cards de resumo + linhas do funil), `AssetsPage.tsx`,
  `LiabilitiesPage.tsx`, `InvestimentosPage.tsx`, `NaturezaPage.tsx`, `ProjecaoPage.tsx`.

### Fora de escopo (explicitamente)

- "Ocultar gasto" (binóculo) e gráfico comparativo de categorias — vira PRD-027.
- Mudança de fórmula ou endpoint de agregação — toda mudança é de apresentação/interação no
  frontend, sobre dado já retornado pelos endpoints de tendência existentes.
- `ProjectionChart.tsx` (tela Projeção, combina histórico real + projeção tracejada): clique-para-
  filtrar não se aplica a pontos futuros (projetados) — se entrar nesta sprint, só nos pontos de
  histórico real; decisão de escopo fino fica para a execução.

## Critérios de aceite

1. Dado qualquer drilldown de categoria no Dashboard, então o mini gráfico por linha é
   visivelmente mais largo (~3x) que hoje.
2. Dado qualquer gráfico de linha do sistema (cards do Dashboard, mini gráfico de drilldown,
   `TrendChart` de Ativos/Passivos/Investimentos/Natureza), quando o mouse passa sobre um ponto,
   então mostra mês/ano e valor, com destaque visual no ponto.
3. Dado o mesmo gráfico, quando o usuário clica num ponto, então a tela filtra pelo mês/ano
   daquele ponto (mesmo padrão de navegação por clique já usado nos cards "Saldo Anterior"/"Saldo
   Acumulado" desde a Sprint 15/24).
4. Dado dois usuários diferentes, nenhuma consulta nova quebra isolamento por `user_id` (não há
   consulta nova prevista — só interação sobre dado já carregado).
5. Dado o CI, quando a suíte roda, então os testes novos/alterados passam com cobertura ≥80% nos
   módulos tocados, suíte completa 100% verde.

## Regras de negócio

- Nenhuma regra de negócio nova — o clique-para-filtrar só reusa o estado `ano`/`mes` que cada
  tela já mantém para seu próprio `PeriodFilter`.

## Dados e modelo

- Sem tabela nova, sem migration, sem endpoint novo previsto — todo gráfico afetado já recebe os
  dados necessários (mês/ano/valor) dos endpoints de tendência existentes.

## Segurança

- Isolamento por usuário preservado (nenhuma consulta nova).
- Nenhum secret novo introduzido.

## Fora de escopo / decisões adiadas

- Consolidação formal dos 3 componentes de gráfico num único componente parametrizado — decisão de
  design de execução, não trancada neste PRD (evitar abstração prematura antes de ver os 3 casos
  de uso lado a lado no código).

## Referências

- [PRD-025 — Escala visual, tela Ativos e cards do Dashboard](PRD-025-escala-visual-tela-ativos-cards-dashboard.md)
  — sprint irmã, roda antes ou depois desta sem dependência de código.
- [PRD-015 — Configurações, competência de salário e Saldo Acumulado](PRD-015-configuracoes-competencia-salario-saldo-acumulado.md)
  — origem do padrão de navegação por clique em card, reaproveitado aqui para pontos de gráfico.
- Plano de sessão: `C:\Users\Daniel\.claude\plans\planejar-sprint-25-ou-distributed-noodle.md`.
