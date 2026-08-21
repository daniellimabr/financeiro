# SPRINT-035: Redesign visual "Analyst Console" — Categorizar/Categorias/Configurações/Natureza — Relatório

- **Plano:** [SPRINT-035-redesign-analyst-console-categorizar-configuracoes-natureza-plan.md](./SPRINT-035-redesign-analyst-console-categorizar-configuracoes-natureza-plan.md)
- **Data do relatório:** 2026-08-21
- **Aprovado pelo CEO em:** pendente — deploy na VM de dev e validação ao vivo já feitos (autonomia de
  execução, ver `docs/infra/ssh-workflow.md`); este relatório aguarda revisão final.

## Resumo

Estendeu o épico E10 (Analyst Console) às 4 telas de maior uso diário depois do Dashboard.
Categorizar e Natureza migraram toolbar/tabela/KPIs para o sistema novo (`--ac-*`), mantendo o
funil/accordion de drill-down no sistema antigo — mesmo corte já estabelecido pela Sprint 34 em
Dashboards, agora um padrão repetido 2x. Categorias deixou de ser aba própria do sidebar (9→8 abas)
e virou um painel lateral (`Drawer.tsx`, componente novo e reutilizável) acessível via botão
"Gerenciar categorias" dentro de Categorizar. Configurações adotou o mesmo padrão de Drawer para
Gestão de Contas ("Gerenciar contas"). `SubcategoryGroupTable` (compartilhado pelos dois
consumidores) migrou junto, sem prop de variante temporária — decisão do CEO na sessão de
planejamento. `KpiTile` ganhou duas props aditivas (`ariaExpanded`, `valueColor`). Implementado,
testado (264 testes frontend, 100% verdes), commitado, CI verde confirmado a cada commit, deployado
na VM de dev, e validado ao vivo com `scripts/browser-check/check-sprint35.mjs` — 2 achados reais de
layout corrigidos no processo (ver "Achados do browser-check" abaixo).

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | `Drawer.tsx` (portal, backdrop, Escape, foco inicial, não monta filhos fechado) + testes | feito | 8 testes cobrindo cada comportamento; ganhou um bloqueio de scroll do `body` enquanto aberto (ver "Achados do browser-check") — não estava no escopo original, adicionado como correção de um achado real |
| 2 | CSS novo (`.ac-drawer-*`, `.ac-btn*`, `.ac-form-row`) | feito | + `.ac-btn-row` (linha de botões inline, não estava listado explicitamente) e `.ac-empty` (equivalente `--ac-*` de `.dash-empty`), ambos necessários pra cobrir o restyle completo das 4 telas sem misturar tokens do sistema antigo |
| 3 | Migrar `SubcategoryGroupTable.tsx` | feito | Standalone (não estende `.ac-table`, cujo default é right-align — não serve pra uma tabela texto/select/ações); `NaturezaPage.test.tsx`/`CategoriasPage.test.tsx` rodados a cada mudança, 0 regressão |
| 4 | Restilizar `CategorizationReviewPage.tsx` + botão "Gerenciar categorias" + Drawer/CategoriasPage | feito | Valor da tabela ganhou `DirectionIcon` (extraído de `TransactionsTable.tsx` pra `components/DirectionIcon.tsx`, reuso) em vez do antigo `TransactionTipoIcon` — alinha com o próprio comentário de Sprint 34 no `.ac-txn-table` ("modelo... inspirado no mockup de Categorização"), mantendo `--ac-good/--ac-bad` em vez de misturar `--despesa/--receita` do sistema antigo dentro de uma tela agora `--ac-*` |
| 5 | Ajustar `CategoriasPage.tsx` (sem cabeçalho próprio) | feito | — |
| 6 | `KpiTile` ganha `ariaExpanded` | feito, com desvio reportado | Também ganhou `valueColor` (não previsto no PRD) — Natureza precisa do eixo de cor `--nat-fixa/--nat-variavel/--nat-eventual` por tile, que os 2 valores fixos de `valueVariant` não cobrem; inline-style override julgado mais simples que uma 3ª variante ou um fork do componente. Documentado em `DESIGN.md` |
| 7 | Restilizar `NaturezaPage.tsx` (KPIs→`KpiTile`, funil intocado) | feito | Nova classe `.ac-kpi-row--3` (grid de 3 colunas em densidade primária, distinta de `.ac-kpi-row--compact`) — os 3 tiles de Natureza não cabiam nas 5 colunas fixas de `.ac-kpi-row` nem faziam sentido na densidade compacta |
| 8 | Restilizar `AccountManagementPage.tsx` por completo | feito | Maior peça de restyle da sprint — `baseline-table` virou standalone (mesmo motivo do item 3), `.simple-list` manteve a classe compartilhada com `OrcamentoPage` (sistema antigo) mas ganhou hover `--ac-blue-bg` escopado via `.ac-drawer-body .simple-list li:hover` (não pode virar `--ac-*` globalmente) |
| 9 | Restilizar `ConfiguracoesPage.tsx` + botão "Gerenciar contas" + Drawer/AccountManagementPage | feito | Perfil/Competência de Salário/Salário dez-2025 viraram 3 `.ac-panel` (mesma linguagem visual do painel de Conciliação em Dashboards) em vez de `<h3>` soltos — mais consistente com o resto do sistema `--ac-*`, que não usa `<h3>` sem container |
| 10 | Remover aba "Categorias" de `ProtectedPage.tsx` | feito | — |
| 11 | Atualizar testes (`ProtectedPage`/`CategorizationReviewPage`/`CategoriasPage`/`ConfiguracoesPage`/`AccountManagementPage`) | feito | 2 testes novos de integração Drawer (abre/fecha, CRUD funciona dentro) em `CategorizationReviewPage.test.tsx` e `ConfiguracoesPage.test.tsx`; `AccountManagementPage.test.tsx` não precisou de mudança (já testava a página isolada, sem depender do cabeçalho removido) |
| 12 | Lint/format/tsc/test/coverage | feito | Ver "Evidência de testes" |
| 13 | Atualizar `DESIGN.md` | feito | Nova entrada documentando `Drawer`, o vocabulário de botão `.ac-btn*`, e o corte "migra KPI, mantém funil" como padrão repetido (não mais um caso único de Dashboards) |
| 14 | Browser-check (4 telas + 2 drawers, claro/escuro/desktop/mobile) | feito, com 2 achados corrigidos | Ver "Achados do browser-check" |
| 15 | Relatório pós-sprint | feito | Este documento |

## Achados do browser-check (2 problemas reais, não capturados pelos testes de jsdom)

1. **Ícone "X" do botão fechar do Drawer invisível.** A regra base de `button` (`padding:
   var(--space-2) var(--space-4)` ≈ 6px/13px) somada a `box-sizing: border-box` global espremia a
   área de conteúdo do botão fixo de 28×28px pra ~2px de largura — o SVG centralizado ficava
   efetivamente cortado/invisível, embora o botão continuasse clicável (a hitbox de 28×28 estava
   intacta). Mesma classe de bug que `.ac-kpi-arrow` (Sprint 34) já evitava com `padding: 0`
   explícito — `.ac-drawer-close` não tinha essa regra. Corrigido com `padding: 0`. Commit
   `2d10776`.
2. **Falso-positivo investigado e descartado, mas gerou uma correção real:** a primeira rodada de
   screenshots (`fullPage: true`) mostrava o backdrop do Drawer cobrindo só o topo da imagem, com
   conteúdo da página "vazando" por baixo. Investigado antes de reportar como bug (regra
   "investigar antes de reinterpretar dado/resultado") — não é um bug real de scroll: `fullPage:
   true` redimensiona o viewport pro tamanho total do documento antes de capturar, e um elemento
   `position: fixed` só acompanha esse redimensionamento sintético uma vez, "descolando" do resto
   da imagem — nunca acontece pra um usuário real, cujo viewport não muda de tamanho ao abrir um
   drawer. Corrigido no script (`fullPage: false` só nas 2 capturas de drawer aberto, commit
   `af9bedd`) — screenshot final confirma o backdrop cobrindo o viewport inteiro corretamente. Na
   investigação, ainda assim ficou claro que o `Drawer` não travava o scroll do `body` por trás dele
   (roda do mouse/teclado sobre a área do backdrop podia rolar a página de fundo, já que um
   `position: fixed` sem `overflow` próprio não intercepta scroll por padrão) — `overflow: hidden`
   no `body` enquanto aberto, restaurado ao fechar/desmontar, é uma correção real e independente do
   achado 1, mantida mesmo não sendo "o bug do screenshot". Commit `47d3497`, com teste novo em
   `Drawer.test.tsx`.

Cada achado foi corrigido, reimplantado (commit → CI verde confirmado por `head_sha` exato → `git
pull` + `docker compose pull/up -d` na VM) e reconfirmado com um novo browser-check antes de seguir
— 3 ciclos completos de fix→deploy→validar nesta sessão, além do deploy inicial da feature. Nenhum
erro de console em nenhuma das 16 combinações capturadas (4 telas + 2 drawers × claro/escuro ×
desktop/mobile). Screenshots em `scripts/browser-check/shots/sprint35-*.png` (gitignored).

## Evidência de testes

Frontend:

```
Test Files  29 passed (29)
     Tests  264 passed (264)
```

Cobertura (`npm run test:coverage`):

```
Statements   : 89.11% ( 1851/2077 )
Branches     : 81.39% ( 1295/1591 )
Functions    : 90.37% ( 817/904 )
Lines        : 91.99% ( 1678/1824 )
```

`Drawer.tsx` (o único arquivo de lógica de negócio inteiramente novo desta sprint) fecha em 100% nas
4 métricas — não aparece na tabela por arquivo do reporter porque só lista arquivos abaixo de 100%.
`npx tsc -b` limpo. `npx eslint .`: 0 erros, 6 warnings pré-existentes (3 de `coverage/` gerado, 3 de
`react-refresh/only-export-components` em arquivos que já tinham esse padrão antes desta sprint —
nenhum novo). `npx prettier --check src/` limpo. `npm run build` (Vite) sem erros.

Backend: nenhuma mudança — sprint estritamente de frontend (sem migration, sem endpoint novo, ver
PRD-035 § Dados e modelo). Suíte backend não precisou rodar.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. `Drawer.tsx` isolado e testado (abre/fecha, backdrop/X/Escape fecham, clique interno não fecha, não monta filhos fechado) | sim | `Drawer.test.tsx`, 8 testes, 100% cobertura |
| 2. Sidebar com 8 abas (sem "Categorias"), nenhuma outra muda de posição | sim | `ProtectedPage.test.tsx` (ordem verificada, botão "Categorias" ausente) |
| 3. Categorizar: "Gerenciar categorias" abre drawer com CRUD completo, sem regressão funcional | sim | `CategorizationReviewPage.test.tsx` (teste novo: abre, cria grupo via POST, fecha); `CategoriasPage.test.tsx` inalterado em cobertura funcional |
| 4. Configurações: "Gerenciar contas" abre drawer com `AccountManagementPage` completo, sem regressão; Perfil/Competência inline | sim | `ConfiguracoesPage.test.tsx` (teste novo: abre, mostra conta real, fecha); demais campos testados como antes |
| 5. `SubcategoryGroupTable` no sistema novo nos 2 consumidores; `NaturezaPage.test.tsx` sem regressão | sim | Mesma suíte, 0 teste removido, migração só de apresentação |
| 6. Natureza: 3 tiles com `KpiTile`+sparkline, abrir/fechar funil preservado | sim | `NaturezaPage.test.tsx` (seletor `.ac-kpi-row--3`, `ariaExpanded` via `aria-expanded`) |
| 7. Nenhuma mudança de valor/cálculo | sim | Nenhum hook/query alterado — só JSX/CSS nas 4 telas |
| 8. Suíte 100% verde, lint sem erros, `tsc` sem erros, cobertura ≥80% em lógica nova | sim | Ver "Evidência de testes" |
| 9. `DESIGN.md` reflete o padrão de Drawer e o corte KPI/funil | sim | Novas entradas em "Analyst Console (Sprint 34/35, épico E10)" |
| 10. Browser-check claro/escuro/desktop/mobile sem overflow/quebra | sim, após 2 correções | Ver "Achados do browser-check" |

## Desvios de escopo registrados

- **`KpiTile` ganhou `valueColor` além de `ariaExpanded`** — necessário pra preservar o eixo de cor
  por natureza (`--nat-fixa/--nat-variavel/--nat-eventual`) nos 3 tiles de Natureza; documentado em
  `DESIGN.md`.
- **`.ac-btn-row` e `.ac-empty`** — 2 classes CSS pequenas não listadas explicitamente no plano, mas
  necessárias pra cobrir grupos de botão inline e texto secundário sem misturar tokens do sistema
  antigo dentro das telas migradas.
- **Correção de bloqueio de scroll do `body` no Drawer** — não estava no PRD/plano original; achado
  durante a investigação de um falso-positivo do browser-check, mantido por ser uma correção real e
  de baixo risco.
- Nenhum desvio de dado/cálculo, nenhuma migration, nenhum endpoint novo — confirma o que o PRD-035
  já previa em "Fora de escopo".

## Deploy

Commits `d4a5dc4` (feature), `47d3497` (fix: scroll lock), `2d10776` (fix: ícone do botão fechar) e
`af9bedd` (fix: script de browser-check) — todos com CI verde confirmado (`head_sha` exato) antes de
cada deploy. Estado final: `api`/`frontend`/`postgres`/`caddy` todos `healthy`/`running` no commit
`af9bedd` na VM de dev. Nenhuma migration — `alembic upgrade head` no entrypoint do `api` foi no-op.

## Próximos passos (backlog do épico E10)

As 5 telas restantes (Ativos, Investimentos, Passivos, Orçamento, Login) seguem no sistema visual
antigo — cada uma vira uma sprint própria do épico E10, a planejar individualmente via `/plan`.
