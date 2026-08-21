# SPRINT-034: Redesign visual "Analyst Console" — fundação + Dashboard — Plano

- **PRD(s):** [PRD-034-redesign-analyst-console-fundacao-dashboard.md](../prd/PRD-034-redesign-analyst-console-fundacao-dashboard.md)
- **Data do plano:** 2026-08-21

## Objetivo da sprint

Levar a direção visual "Analyst Console" (aprovada pelo CEO a partir de 3 propostas comparadas) do
mockup para o sistema real: novos tokens de design, shell/sidebar, e a página de Dashboard completa
— os 4 valores centrais (Receita/Despesa/Saldo/Saldo Acumulado) com delta+sparkline e a conferência
do Saldo Acumulado sempre visível, ligando a UI ao workflow real de conciliação bancária validado
nas Sprints 32/33. Primeira sprint do novo épico E10; as outras 10 telas do app ficam para sprints
futuras, cada uma com seu próprio `/plan`.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Configurar `@vitest/coverage-v8`: instalar dep, script `test:coverage` no `package.json`, config de threshold em `vite.config.ts` (80% em lógica de negócio — excluir arquivos puramente de apresentação sem lógica) | Sonnet: implementação | `frontend/vite.config.ts`, `frontend/package.json` |
| 2 | Baixar Inter self-hosted (pesos 400/500/600/700/800, `.woff2`) para `frontend/public/fonts/`, mesmo padrão do Archivo/Public Sans atual | Sonnet: implementação | `frontend/public/fonts/` (padrão existente) |
| 3 | Reescrever tokens em `frontend/src/index.css` (`:root` + `:root[data-theme="dark"]`): paleta Analyst Console (accent azul-aço, verde=receita/vermelho=despesa como semântica separada do accent), tipografia Inter, mantendo Tabular Money Rule e Flat Ledger Rule | Sonnet: implementação | `frontend/src/index.css`, mockup Artifact "Analyst Console" |
| 4 | Criar `frontend/src/components/KpiTile.tsx` (label + delta vs. período anterior + valor + sparkline + selo de conferência opcional) + testes | Sonnet: implementação | Mockup, `frontend/src/components/TrendLineChart.tsx` (referência de sparkline existente) |
| 5 | Criar helper de tooltip/crosshair reutilizável para gráfico de linha (hover mostra mês + valor exato) + testes | Sonnet: implementação | Mockup (interação de hover do comparativo Receita/Despesa) |
| 6 | Restilizar `frontend/src/pages/ProtectedPage.tsx` (shell/sidebar) no novo sistema; atualizar `ProtectedPage.test.tsx` | Sonnet: implementação | `frontend/src/pages/ProtectedPage.tsx` |
| 7 | Investigar se o delta vs. mês anterior de cada KPI pode ser derivado dos dados de tendência já buscados hoje (hooks existentes de histórico/sparkline) — se precisar de dado novo da API, reportar como desvio de escopo antes de expandir o backend | Sonnet: investigação | `frontend/src/hooks/useDashboardSummary.ts`, `useDashboardSaldoAcumulado.ts` e afins |
| 8 | Migrar `frontend/src/pages/DashboardsPage.tsx`: KPI row de fluxo (`KpiTile` × 5) + row Ativos/Passivos/Patrimônio + tabela de conferência do Saldo Acumulado sempre visível (reaproveitar `SaldoAcumuladoConferenciaTable`, só restilizar) + comparativo Receita/Despesa em pequenos múltiplos com escala compartilhada e tooltip + navegador de mês funcional | Sonnet: implementação | `DashboardsPage.tsx` (1.518 linhas), mockup |
| 9 | Atualizar `DashboardsPage.test.tsx` (1.336 linhas) para a nova estrutura — revisar teste a teste, não reescrever em bloco, pra não perder cobertura de regra de negócio já validada | Sonnet: implementação | `DashboardsPage.test.tsx` |
| 10 | Rodar `npm run lint`, `npm run format`, `npx tsc -b`, `npm test`, `npm run test:coverage` — suíte 100% verde, cobertura ≥80% em lógica de negócio nova/alterada | Sonnet: implementação | CI (`.github/workflows/ci.yml`) |
| 11 | Reescrever `DESIGN.md` a partir do sistema construído (mesmo padrão das Sprints 5/13) | Sonnet: implementação | `DESIGN.md` atual, mockup |
| 12 | Browser-check (`scripts/browser-check/`): capturar Dashboard novo em claro/escuro, desktop/mobile; comparar contra o mockup aprovado | Sonnet: implementação (SSH VM dev) | `scripts/browser-check/check.mjs`, `docs/infra/ssh-workflow.md` |
| 13 | Atualizar `docs/roadmap.md`: novo épico E10 (Sprint 34 como primeira entrada, 10 telas restantes como backlog do épico), registro datado da decisão de adiar a auditoria estrutural | Sonnet: implementação | `docs/roadmap.md` |
| 14 | Relatório pós-sprint (`SPRINT-034-...-report.md`) | Sonnet: implementação | — |

## Coerência de Design (DESIGN.md)

Esta sprint **é** a mudança de `DESIGN.md` — não uma checagem de coerência contra o sistema atual,
mas a substituição documentada dele. Fonte de verdade visual: o mockup aprovado ("Analyst Console",
Proposta 3, visão Dashboard). `DESIGN.md` é reescrito ao final, a partir do que foi de fato
construído (mesmo padrão das Sprints 5 e 13), não escrito antes como especificação aspiracional.
Regras que sobrevivem do sistema atual e não devem ser reabertas: Tabular Money Rule (todo valor
monetário com `tabular-nums`), Flat Ledger Rule (sem sombra em nenhum lugar), One Meaning Rule
(verde/vermelho exclusivos de receita/despesa, nunca reusados para outro significado).

## Testes previstos

- `KpiTile`: renderização de label/valor/delta (positivo, negativo, zero), sparkline com dados
  vazios/insuficientes, selo de conferência presente/ausente.
- Helper de tooltip/crosshair: posição correta ao passar o mouse em diferentes pontos, mês/valor
  exibido bate com o dado, esconde ao tirar o mouse.
- `DashboardsPage`: os 5 KPIs de fluxo renderizam com o delta calculado corretamente a partir do
  histórico; navegador de mês troca o período e não avança além do mês corrente; tabela de
  conferência do Saldo Acumulado aparece sem interação (sem clique); nenhuma regressão nos valores
  exibidos (mesmo dado, mesma soma, só apresentação nova).
- `ProtectedPage`: navegação continua funcionando (troca de aba, item ativo).
- Cobertura: `npm run test:coverage` ≥80% nos arquivos de lógica de negócio tocados/criados nesta
  sprint (`KpiTile`, helper de tooltip, hooks/cálculo de delta, `DashboardsPage`).

## Impacto no roadmap

Cria o épico **E10 — Redesign visual (Analyst Console)**. Sprint 34 é a primeira sprint do épico
(fundação + Dashboard); as 10 telas restantes (Categorização, Ativos, Investimentos, Passivos,
Configurações, Natureza, Orçamento, Categorias, Login) ficam registradas como backlog do épico, cada
uma a planejar com seu próprio `/plan` — não estimadas nem sequenciadas nesta sprint.

Conta para a cadência de auditoria estrutural (Sprint 34 = 5ª desde a última verificação). O CTO
propôs rodar o `structural-auditor` antes de começar esta sprint (ADR-003 cita troca de sistema de
design como o cenário que a auditoria existe para pegar); **o CEO decidiu adiar** — registrar no
roadmap com data, para não reabrir sem pedido explícito dele.

## Riscos / dependências

- **Dois sistemas visuais coexistindo** durante o épico E10 (Dashboard novo, as outras 10 telas no
  sistema atual) — inconsistência visual temporária aceita explicitamente pelo CEO, para não repetir
  o excesso de escopo que a Sprint 13 (maior sprint até hoje, cobrindo bem menos) já sinalizou como
  arriscado.
- **`DashboardsPage.test.tsx`** tem 1.336 linhas — risco real de quebrar cobertura de regra de
  negócio já validada se for reescrito em bloco; revisar teste a teste.
- **Delta vs. mês anterior** pode exigir dado que a API hoje não expõe (tarefa 7 investiga antes de
  implementar) — se precisar de endpoint novo, é desvio de escopo a reportar ao CEO, não decisão
  unilateral de ampliar o backend nesta sprint.
- **Indicador de conciliação na sidebar** (mockup) fica de fora — precisa de hook/endpoint novo, vira
  backlog do épico.
- Nenhuma migration, nenhuma mudança de lógica de cálculo — reduz risco de regressão de dado real na
  VM de dev (a única VM rodando o app, com dados reais da família sincronizados).
- Deploy segue o fluxo padrão do projeto (relatório → aprovação do CEO → deploy manual na VM de dev)
  — não incluído nesta sprint até o relatório ser aprovado.
