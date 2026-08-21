# SPRINT-036: Redesign visual "Analyst Console" — restante do Épico 10 — Plano

- **PRD(s):** [PRD-036a-redesign-analyst-console-ativos-passivos-orcamento-login.md](../prd/PRD-036a-redesign-analyst-console-ativos-passivos-orcamento-login.md)
  (reskin), [PRD-036b-redesign-analyst-console-investimentos.md](../prd/PRD-036b-redesign-analyst-console-investimentos.md)
  (revamp, escopo final pendente da Fase 1)
- **Data do plano:** 2026-08-21

## Objetivo da sprint

Fechar o épico E10 (Analyst Console): as 5 telas restantes do sistema visual original — Ativos,
Passivos, Orçamento, Login e Investimentos. As 4 primeiras seguem o reskin mecânico já usado 3x no
épico ("KPI migra, funil fica"). Investimentos é diferente por pedido explícito do CEO: vira uma
"tela de análise de progresso dos investimentos" (visão consolidada, não só card por card), com
layout o mais padronizado possível com o Dashboard — decidido via sessão de avaliação de layout
(2-3 propostas via Artifact) antes de a implementação começar, mesmo processo que escolheu a
Proposta 3 do redesign geral do épico.

Auditoria estrutural: contador em 6/5 sprints desde a última verificação, adiada por decisão
explícita do CEO na Sprint 34 — não é assunto desta sprint, só registrar a contagem ao atualizar
`docs/roadmap.md` no fim.

## Sequenciamento

1. Sessão de avaliação de layout de Investimentos roda cedo na sprint (não bloqueia o resto).
2. PRD-036a executado em paralelo/logo em seguida.
3. Com a proposta de Investimentos escolhida pelo CEO, PRD-036b é detalhado e executado.
4. Browser-check em 2 rodadas (uma por PRD).

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | **Fase 1 — Sessão de avaliação de layout de Investimentos**: gerar 2-3 propostas de informação/IA (wireframes com dados fictícios) via Artifact, reaproveitando ao máximo `KpiTile`/`TrendLineChart`/`ChartTooltip`/`.ac-panel` do Dashboard; apresentar ao CEO para escolha de direção (e decisão sobre endpoint agregado vs. composição client-side) | Sonnet: design/planejamento | `frontend/src/pages/DashboardsPage.tsx`, `DESIGN.md`, PRD-036b |
| 2 | Detalhar PRD-036b com os critérios de aceite específicos da proposta escolhida | Sonnet: planejamento | PRD-036b, resultado da tarefa 1 |
| 3 | Criar `frontend/src/components/AcItemCard.tsx` + teste unitário (render com/sem sparkline, com/sem tag, grupo de botões via `children`) | Sonnet: implementação | `AssetsPage.tsx`, `LiabilitiesPage.tsx` (estrutura `.dash-tile` atual) |
| 4 | Restilizar `frontend/src/pages/LoginPage.tsx` — só CSS em `frontend/src/index.css` (`.login-hero`/`.login-hero a` para tokens `--ac-*` + Inter), sem mudança de JSX | Sonnet: implementação | `frontend/src/index.css`, `LoginPage.tsx` |
| 5 | Restilizar `frontend/src/pages/OrcamentoPage.tsx` (`.ac-page`/`.ac-toolbar`/`.ac-panel`/`.ac-form-row`/`.ac-seg`) | Sonnet: implementação | `OrcamentoPage.tsx`, `OrcamentoPage.test.tsx` |
| 6 | Restilizar `frontend/src/pages/AssetsPage.tsx` usando `AcItemCard`, toolbar/diálogos `.ac-*`; funil (`.dash-funnel`/`Row`) intocado | Sonnet: implementação | `AssetsPage.tsx`, `AssetsPage.test.tsx` |
| 7 | Restilizar `frontend/src/pages/LiabilitiesPage.tsx` usando `AcItemCard` (sparkline `var(--ac-bad)`), toolbar/diálogos `.ac-*`, `RegimeToggle variant="ac"`; funil intocado | Sonnet: implementação | `LiabilitiesPage.tsx`, `LiabilitiesPage.test.tsx` |
| 8 | Atualizar testes de seletor (`AssetsPage.test.tsx`, `LiabilitiesPage.test.tsx`, `OrcamentoPage.test.tsx`) para as novas classes `.ac-*`/`AcItemCard`; confirmar que nenhum `expect` ficou "verde por acidente" | Sonnet: implementação | arquivos de teste correspondentes |
| 9 | Rodar `npm run lint`, `npm run format`, `npx tsc -b`, `npm test`, `npm run test:coverage` para PRD-036a — suíte 100% verde, cobertura ≥80% | Sonnet: implementação | CI (`.github/workflows/ci.yml`) |
| 10 | Atualizar `DESIGN.md`: registrar `AcItemCard`, atualizar "What stays on the original system" (só Investimentos resta) | Sonnet: implementação | `DESIGN.md` |
| 11 | Browser-check PRD-036a (`scripts/browser-check/check-sprint36a.mjs`): claro/escuro, desktop/mobile, Ativos/Passivos/Orçamento (sessão autenticada) + Login (fluxo standalone, sem sessão) | Sonnet: implementação (SSH VM dev) | `scripts/browser-check/`, `docs/infra/ssh-workflow.md` |
| 12 | Implementar decisão de dados de Investimentos (composição client-side via `useQueries` OU endpoint agregado `GET /investimentos/evolucao-mensal` em `backend/app/investimentos/router.py`/`service.py` + teste pytest) conforme decidido na tarefa 2 | Sonnet: implementação | `backend/app/investimentos/service.py`, `router.py`, `frontend/src/hooks/` |
| 13 | Se `MonthNav` for necessário: promover de local em `DashboardsPage.tsx` para `frontend/src/components/MonthNav.tsx` + `MonthNav.test.tsx` | Sonnet: implementação | `DashboardsPage.tsx` (linha ~661) |
| 14 | Implementar a nova `InvestimentosPage.tsx` (visão consolidada) conforme a proposta escolhida — reaproveitando `KpiTile`/`TrendLineChart`/`ChartTooltip`/`.ac-panel`; manter Extrato/Posições como funil no sistema antigo | Sonnet: implementação | `InvestimentosPage.tsx` (618 linhas atuais), proposta escolhida na tarefa 1 |
| 15 | Extrair qualquer lógica de agregação nova (soma por mês, resolução de confiança mista) como função pura testável | Sonnet: implementação | mesmo padrão de `resolveKpiDeltaPercent`/`computeSharedDomain` |
| 16 | Atualizar `InvestimentosPage.test.tsx` e testes de hooks novos | Sonnet: implementação | `InvestimentosPage.test.tsx` |
| 17 | Rodar suíte completa (frontend + backend se endpoint novo) para PRD-036b — 100% verde, cobertura ≥80% | Sonnet: implementação | CI |
| 18 | Atualizar `DESIGN.md` (fecha "What stays on the original system" — nenhuma tela restante) e `docs/roadmap.md` (E10 concluído, contagem de auditoria estrutural) | Sonnet: implementação | `DESIGN.md`, `docs/roadmap.md` |
| 19 | Browser-check PRD-036b (`scripts/browser-check/check-sprint36b.mjs`): claro/escuro, desktop/mobile, Investimentos — atenção a overflow da tabela de série histórica e a qualquer `position: fixed` novo (`fullPage: false`) | Sonnet: implementação (SSH VM dev) | `scripts/browser-check/` |
| 20 | Relatório pós-sprint (`SPRINT-036-...-report.md`) | Sonnet: implementação | — |

## Coerência de Design (DESIGN.md)

Fecha o épico E10 no sistema `--ac-*`. As 4 telas de PRD-036a seguem exatamente o precedente já
documentado ("KPI migra, funil fica") — nenhuma decisão de design nova a reabrir. Investimentos é a
primeira vez que uma tela do épico recebe uma sessão de avaliação de layout dedicada desde a escolha
da Proposta 3 original — a identidade visual não é reaberta, só a informação/IA da tela, com
restrição explícita de reaproveitar o máximo possível do vocabulário já existente (Dashboard) em vez
de introduzir padrões novos.

## Testes previstos

- `AcItemCard`: render com/sem sparkline, com/sem tag, grupo de botões via `children` — unidade
  própria, mesmo padrão de `KpiTile`.
- `AssetsPage`/`LiabilitiesPage`/`OrcamentoPage`: regras de negócio existentes (venda, quitação,
  criação/edição de orçamento) sem regressão — validadas via teste existente reescrito com novo
  seletor, não teste novo, exceto se o reskin acidentalmente alterar comportamento.
- `LoginPage`: sem teste novo (mudança é só CSS).
- `MonthNav` (se promovido): teste próprio de rollover de mês.
- Investimentos: qualquer função de agregação nova, testada isoladamente; se endpoint agregado
  criado, teste pytest cobrindo agregação multi-investimento, isolamento por usuário, usuário sem
  investimentos/snapshots.
- Cobertura ≥80% em lógica de negócio nova/alterada nos dois PRDs; suíte 100% verde antes de cada
  rodada de browser-check.

## Impacto no roadmap

Fecha o épico E10 (`docs/roadmap.md`) — nenhuma tela restante no sistema visual original após esta
sprint. `doc-updater` atualiza a linha do E10 para "✅" e a tabela de auditoria estrutural com a
contagem atualizada (Sprint 30-36 = 7 sprints desde a última auditoria, ainda sob a decisão do CEO
de não reabrir sem provocação dele).

## Riscos / dependências

- **Escopo de Investimentos não é conhecido até a Fase 1** — o plano desta sprint cobre o processo
  (sessão de layout → PRD detalhado → implementação), não o resultado final. Se a proposta escolhida
  exigir mais trabalho que o esperado (ex.: endpoint agregado + lógica de confiança mista +
  reestruturação grande do funil), a sprint pode precisar de mais uma rodada de execução — decisão a
  tomar com o CEO ao final da Fase 1, não presumida aqui.
- **`AcItemCard` compartilhado entre Ativos e Passivos** — mesmo risco de acoplamento que
  `SubcategoryGroupTable` teve na Sprint 35; mitigado por implementar e testar antes de aplicar às
  duas telas, rodando os dois conjuntos de teste a cada mudança no componente.
- **Campo `confianca` (real/reconstruído) agregado entre investimentos** — maior risco de dado
  incorreto da sprint; qualquer regra de composição precisa ser explícita e testada, não inferida.
- **`PeriodFilter.tsx` não deve ser alterado** — compartilhado por várias telas fora de escopo
  (Categorizar, Natureza, Orçamento, auditoria de saldo); só estilização via CSS descendente.
- Nenhuma migration prevista pelas opções conhecidas hoje (endpoint agregado, se criado, é uma
  leitura nova, não uma mudança de schema) — risco de regressão de dado real na VM de dev
  (único ambiente rodando o app, dados reais da família) permanece baixo.
- Deploy segue o fluxo padrão do projeto (relatório → aprovação do CEO → deploy manual na VM de dev)
  — não incluído nesta sprint até o relatório ser aprovado.
