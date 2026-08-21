# PRD-036b: Redesign visual "Analyst Console" — Investimentos (revamp de análise de progresso)

- **Status:** implementado — Fase 1 (sessão de layout) escolheu a Proposta C ("Split analítico");
  Fase 2 (critérios de aceite concretos, abaixo) e Fase 3 (implementação) concluídas na mesma sprint.
- **Épico relacionado:** E10 — Redesign visual (Analyst Console) (ver `docs/roadmap.md`). Parte da
  Sprint 36, junto com [PRD-036a](PRD-036a-redesign-analyst-console-ativos-passivos-orcamento-login.md)
  (reskin de Ativos/Passivos/Orçamento/Login).
- **Sprint(s):** [SPRINT-036-redesign-analyst-console-restante-epico10-plan.md](../sprints/SPRINT-036-redesign-analyst-console-restante-epico10-plan.md)

## Problema

`InvestimentosPage.tsx` é a única tela restante do épico E10 cujo pedido do CEO não é um reskin —
ele pediu um **revamp total**: a tela deve virar uma "tela de análise de progresso dos
investimentos". Hoje a tela mostra card por card (grid de `InvestimentoCard`, cada um com valor
atual, rendimento estimado e sparkline) e, ao selecionar um investimento, um funil de 3 abas
(Extrato/Posições/Série histórica). Não existe nenhuma visão consolidada — o usuário não consegue
ver o progresso do patrimônio investido como um todo, só investimento a investimento.

O CEO pediu explicitamente que essa mudança de conteúdo/informação passe por uma **sessão de
avaliação de layout** antes da implementação — o mesmo processo que escolheu a Proposta 3 do
redesign geral do Analyst Console (2-3 propostas comparadas via Artifact). A identidade visual (
`--ac-*`, Inter) já está fixa e não é reaberta nessa sessão; o que está em aberto é a informação
exibida e sua hierarquia (quais KPIs consolidados, que gráficos, o que acontece com o funil
individual por investimento) — e, por decisão explícita do CEO, o layout deve ficar **o máximo
possível padronizado com a tela de Dashboard**: reaproveitar `KpiTile`, a convenção de navegação por
mês, `TrendLineChart`, `ChartTooltip` e `.ac-panel`, não inventar componentes ou padrões visuais
novos específicos desta tela.

## Processo desta sprint (diferente do padrão do épico até aqui)

1. **Fase 1 — sessão de avaliação de layout** (primeiro passo da execução, sessão nova após
   aprovação do plano de sprint): 2-3 propostas de informação/IA para a tela consolidada,
   apresentadas como Artifact com dados fictícios, usando os componentes do Dashboard listados
   acima. O CEO escolhe uma direção (ou pede ajustes).
2. **Fase 2 — este PRD é detalhado/atualizado** com os critérios de aceite reais, a partir da
   proposta escolhida — antes disso os critérios de aceite abaixo são apenas os invariantes que
   valem independente de qual proposta for escolhida.
3. **Fase 3 — implementação**, incluindo a decisão de dados (ver abaixo) e, se necessário, o
   endpoint agregado novo.

## O que já está decidido (independente da proposta escolhida)

- Identidade visual: sistema Analyst Console (`--ac-*`), não o sistema original.
- Máximo reaproveitamento de componentes/convenções já usados no Dashboard — nenhum padrão visual
  novo específico de Investimentos, salvo necessidade genuína não coberta pelo vocabulário existente.
- `MonthNav` (hoje local a `DashboardsPage.tsx`) deve ser promovido a componente compartilhado
  (`frontend/src/components/MonthNav.tsx`) se a proposta escolhida usar navegação por mês — primeira
  vez que uma segunda tela precisaria dele.
- Extrato (`InvestimentoDrilldown`) e Posições (`InvestimentoPosicoes`/`PosicaoHistorico`) são
  detalhe operacional por investimento individual — não fazem sentido consolidados entre
  investimentos. Ficam como funil de baixo no sistema antigo, seguindo o precedente "KPI migra,
  funil fica", independente da proposta escolhida.
- Série histórica (`InvestimentoSerieHistorica`) é a candidata natural a alimentar a visão
  consolidada — sua forma exata (sumir do funil individual, coexistir, ou virar drilldown focado a
  partir do card) é decidida na sessão de layout, não aqui.

## Decisão de dados a resolver junto da escolha de proposta

Hoje não existe endpoint agregado de evolução mensal somando todos os investimentos do usuário — só
`GET /investimentos/{id}/evolucao-mensal` por investimento (`backend/app/investimentos/router.py`,
`service.py`, fonte `PluggyInvestmentSnapshot`). Duas rotas, a decidir junto com o CEO na sessão de
layout (mesmo tipo de trade-off já resolvido para os deltas de Ativos/Passivos/Patrimônio na Sprint
34):

- **Composição client-side**: `useQueries` (TanStack Query) sobre a lista dinâmica de investimentos,
  somando por `ano_mes` no cliente. Zero mudança de backend, mas replica N requisições HTTP e a
  lógica de "confiança mista" (ver Riscos) no cliente.
- **Endpoint agregado novo** (`GET /investimentos/evolucao-mensal`, sem `{id}`): agregação no
  backend, resolve a lógica de confiança mista uma vez só, evita N requisições — custa escopo de
  backend + teste pytest novo.

## Riscos técnicos

- Campo `confianca` (`real`/`reconstruido`) por mês por investimento: ao agregar, um mês pode ter
  parcelas reais e reconstruídas misturadas entre investimentos diferentes — precisa de regra
  explícita de composição (ex.: mês agregado é "reconstruído" se qualquer parcela for) e de uma
  forma de comunicar isso sem virar ruído visual em escala agregada.
- Investimentos sem snapshot ainda (baseline dez/2025 não confirmado) — o card/KPI consolidado
  precisa de um estado vazio/parcial coerente.
- Performance de N chamadas paralelas, se a composição for client-side (baixo volume hoje — app de
  2 usuários — mas monitorado).
- Escopo de revamp é maior que reskin — a estimativa de esforço só fica sólida depois da Fase 1.

## Critérios de aceite (invariantes, independentes da proposta)

1. Identidade visual 100% `--ac-*`/Inter, zero classe do sistema original na camada consolidada nova.
2. Extrato e Posições por investimento continuam funcionando sem regressão (mesmos dados, mesmo
   comportamento de hoje), como funil no sistema antigo.
3. Nenhuma mudança de valor/cálculo em dado já exibido hoje (saldo, rendimento estimado, aportes,
   resgates) — só apresentação/consolidação nova.
4. Se o endpoint agregado for criado: isolado por usuário (regra transversal do CLAUDE.md), testado
   (pytest) para agregação multi-investimento e para usuário sem investimentos/snapshots.
5. Qualquer lógica de agregação nova (soma por mês, resolução de confiança mista) extraída como
   função pura testável isoladamente (mesmo padrão de `resolveKpiDeltaPercent`/
   `computeSharedDomain`).
6. Suíte 100% verde, lint sem erros, `npx tsc -b` sem erros, cobertura ≥80% em lógica de negócio
   nova/alterada.
7. `DESIGN.md` e `docs/roadmap.md` atualizados ao final — E10 fecha (nenhuma tela restante no
   sistema original).
8. Browser-check cobrindo claro/escuro, desktop/mobile — atenção especial a overflow na tabela de
   série histórica (8 colunas) e a qualquer `position: fixed` novo (usar `fullPage: false` nas
   capturas correspondentes, evitando o falso-positivo já corrigido no commit `af9bedd`).

## Fase 2 — proposta escolhida e critérios de aceite específicos

O CEO escolheu a **Proposta C ("Split analítico")** entre as 3 apresentadas via Artifact
(2026-08-21): KPIs no topo iguais ao Dashboard, gráfico consolidado e ranking de desempenho lado a
lado, grid de entrada por investimento embaixo. Decisão de dados: **endpoint agregado novo**
(recomendação aceita) em vez de composição client-side.

1. **KPIs consolidados** (`.ac-kpi-row`, 4 `KpiTile`s, mesma receita da linha "Fluxo do mês" do
   Dashboard — delta% vs. mês anterior + sparkline cada): Patrimônio Investido, Rendimento do Mês,
   Aportes, Resgates. Fonte: `GET /investimentos/evolucao-mensal` (novo, backend), mês selecionado
   via `MonthNav` (promovido a componente compartilhado).
2. **Painel de duas colunas** (`.ac-two-col`): à esquerda, `TrendLineChart variant="card"` da
   evolução do patrimônio (últimos 6 meses, mesma janela `PERIODO_HISTORICO` do resto do app); à
   direita, `.ac-table` "Desempenho no mês" ranqueando cada investimento pelo rendimento do mês
   filtrado (maior pro menor), com badge de confiança (`real`/`reconstruído`) por linha.
3. **Grid de entrada por investimento** (`.ac-kpi-grid`, auto-fit): um `KpiTile` por investimento
   (reaproveitado diretamente, sem componente novo) — valor = `saldo_atual` real (contas + holdings,
   via `useInvestimentoEvolucao`, não a série agregada), legenda = rendimento estimado desde o
   baseline (comportamento idêntico ao card antigo), sparkline = evolução mensal de saldo
   (`GET /investimentos/{id}/evolucao-mensal`, holdings). Clique abre o funil abaixo.
4. **Funil individual inalterado**: Extrato/Posições/Série histórica seguem `.dash-funnel` no
   sistema antigo, sem nenhuma mudança visual ou de dado. Editar/Excluir (sem espaço no tile de
   entrada, que agora é um único alvo de clique) moveram para o cabeçalho do funil, ao lado de
   "Fechar".
5. **Limitação assumida e comunicada**: o endpoint agregado (como o já existente por-investimento)
   só soma holdings com snapshot Pluggy — investimentos só com carteira bancária vinculada ainda não
   entram no histórico mensal. O painel "Evolução do patrimônio" diz isso explicitamente na legenda;
   o valor de cada tile de entrada continua exato (contas + holdings) independentemente dessa
   lacuna, então os dois números podem legitimamente divergir sem ser bug.
6. **`GET /investimentos/evolucao-mensal`** (`backend/app/investimentos/router.py`/`service.py`):
   isolado por usuário (dupla filtragem, mesmo padrão de `list_investimentos_com_valor_atual`),
   regra de confiança mista ("reconstruído" se qualquer holding contribuinte no mês for) resolvida
   numa função pura compartilhada com o endpoint por-investimento (`_aggregate_snapshots_por_mes`),
   testada via pytest (agregação multi-investimento, usuário sem investimentos, usuário sem
   holdings vinculados, isolamento por usuário, holding não-vinculado ignorado).
7. **`MonthNav` promovido** a `frontend/src/components/MonthNav.tsx` (junto com
   `mesAnterior`/`mesSeguinte`/`isMesAtual` em `frontend/src/utils/monthNav.ts`) — segunda tela a
   precisar dele, `DashboardsPage.tsx` passou a importar do mesmo lugar em vez de manter uma cópia
   local.
8. **Lógica de agregação extraída como função pura testável** (`frontend/src/utils/
   investimentosConsolidado.ts`): `evolucaoMensalParaPontos` (converte a série `ano_mes` pro formato
   `PontoTendencia` que `TrendLineChart`/`KpiTile` já sabem desenhar), `encontrarMesEAnterior`
   (localiza o mês filtrado e o anterior na série, pro valor exibido e pro delta%),
   `temMesReconstruido` — todas com teste unitário próprio, independente de rede.

## Dados e modelo

- Migration: nenhuma prevista pelas opções conhecidas hoje; se a proposta escolhida exigir dado novo
  não coberto por `PluggyInvestmentSnapshot`, avaliar na Fase 2.
- Endpoint novo: condicional à decisão de dados acima.
- Nenhum dado sensível novo, nenhum secret.

## Segurança

- Isolamento por usuário mantido em qualquer endpoint novo (mesma regra transversal do projeto).

## Referências

- [PRD-021](PRD-021-vinculo-holdings-serie-historica.md) — origem funcional da série histórica
  mensal e do modelo `PluggyInvestmentSnapshot` que esta sprint consome.
- [PRD-034](PRD-034-redesign-analyst-console-fundacao-dashboard.md) — origem de `KpiTile`,
  `TrendLineChart`, `ChartTooltip`, `.ac-panel`, base de reaproveitamento desta sprint.
- [PRD-036a](PRD-036a-redesign-analyst-console-ativos-passivos-orcamento-login.md) — PRD irmão desta
  sprint.
- [DESIGN.md](../../DESIGN.md) — seção "Analyst Console".
