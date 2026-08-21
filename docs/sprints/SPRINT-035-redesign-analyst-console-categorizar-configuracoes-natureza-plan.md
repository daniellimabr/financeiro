# SPRINT-035: Redesign visual "Analyst Console" — Categorizar, Categorias, Configurações, Natureza — Plano

- **PRD(s):** [PRD-035-redesign-analyst-console-categorizar-configuracoes-natureza.md](../prd/PRD-035-redesign-analyst-console-categorizar-configuracoes-natureza.md)
- **Data do plano:** 2026-08-21

## Objetivo da sprint

Continuar o épico E10 (Analyst Console) migrando as 4 telas de maior uso diário depois do Dashboard:
Categorizar (fila de revisão de transações), Categorias (CRUD, absorvida como drawer dentro de
Categorizar), Configurações (com Gestão de Contas absorvida como drawer) e Natureza (migrada junto por
compartilhar `SubcategoryGroupTable` com Categorias). Introduz o padrão de "drawer" no sistema Analyst
Console — primeira vez que o épico precisa de um painel lateral sobre uma tela.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Criar `frontend/src/components/Drawer.tsx` (portal, backdrop, Escape, foco inicial, não monta filhos fechado) + `Drawer.test.tsx` | Sonnet: implementação | `frontend/src/components/CategoryCombobox.tsx` (padrão de portal/Escape existente) |
| 2 | CSS novo em `frontend/src/index.css`: `.ac-drawer-*`, `.ac-btn`/`.ac-btn-primary`/`.ac-btn-ghost`/`.ac-btn-danger`, `.ac-form-row` | Sonnet: implementação | `frontend/src/index.css` (tokens `--ac-*` da Sprint 34) |
| 3 | Migrar `frontend/src/components/SubcategoryGroupTable.tsx` para Analyst Console (sem prop de variante) — rodar `NaturezaPage.test.tsx` e `CategoriasPage.test.tsx` a cada mudança | Sonnet: implementação | `SubcategoryGroupTable.tsx`, `NaturezaPage.test.tsx`, `CategoriasPage.test.tsx` |
| 4 | Restilizar `frontend/src/pages/CategorizationReviewPage.tsx` (`ac-page`/`ac-toolbar`/`ac-txn-table`) + botão "Gerenciar categorias" + integração com `Drawer`/`CategoriasPage` | Sonnet: implementação | `CategorizationReviewPage.tsx` (455 linhas), mockup/padrão da Sprint 34 |
| 5 | Ajustar `frontend/src/pages/CategoriasPage.tsx`: remover cabeçalho próprio (título passa a vir do `Drawer`), validar que continua funcionando montada só dentro do drawer | Sonnet: implementação | `CategoriasPage.tsx` |
| 6 | Adicionar prop opcional `ariaExpanded` a `frontend/src/components/KpiTile.tsx` (aditiva, não quebra usos existentes em `DashboardsPage.tsx`) | Sonnet: implementação | `KpiTile.tsx` |
| 7 | Restilizar `frontend/src/pages/NaturezaPage.tsx`: `ac-page`/`ac-toolbar`, tiles Fixo/Variável/Eventual migrados para `KpiTile`; manter `.dash-funnel`/`.dash-accordion` como está (mesmo corte da Sprint 34 em Dashboards) | Sonnet: implementação | `NaturezaPage.tsx`, `DashboardsPage.tsx` (referência do corte KPI-migra/funil-fica) |
| 8 | Restilizar `frontend/src/pages/AccountManagementPage.tsx` por completo (baseline de saldo, tabela de auditoria, holdings, `.simple-list`); remover cabeçalho próprio | Sonnet: implementação | `AccountManagementPage.tsx` |
| 9 | Restilizar `frontend/src/pages/ConfiguracoesPage.tsx` (`ac-page`, `.ac-section-label`, `.ac-form-row`); remover seção "Gestão de Contas" inline; adicionar botão "Gerenciar contas" + integração com `Drawer`/`AccountManagementPage` | Sonnet: implementação | `ConfiguracoesPage.tsx` |
| 10 | Remover aba "Categorias" de `frontend/src/pages/ProtectedPage.tsx` (`Tab`, `NAV_ITEMS`, `NAV_ICONS`, import/render de `CategoriasPage`) | Sonnet: implementação | `ProtectedPage.tsx` |
| 11 | Atualizar testes: `ProtectedPage.test.tsx` (ordem de nav com 8 abas, remover teste da aba Categorias), `CategorizationReviewPage.test.tsx` (botão abre/fecha drawer, CRUD funciona dentro dele), `CategoriasPage.test.tsx` (sem cabeçalho próprio), `ConfiguracoesPage.test.tsx` (botão "Gerenciar contas" abre drawer, sem seção inline), `AccountManagementPage.test.tsx` (sem cabeçalho próprio, testado isolado fora do drawer) | Sonnet: implementação | arquivos de teste correspondentes |
| 12 | Rodar `npm run lint`, `npm run format`, `npx tsc -b`, `npm test`, `npm run test:coverage` — suíte 100% verde, cobertura ≥80% em lógica de negócio nova/alterada | Sonnet: implementação | CI (`.github/workflows/ci.yml`) |
| 13 | Atualizar `DESIGN.md`: nova entrada documentando o padrão de `Drawer` e o corte "migra KPI, mantém funil/accordion" | Sonnet: implementação | `DESIGN.md` |
| 14 | Browser-check (`scripts/browser-check/`): capturar as 4 telas + os 2 drawers abertos, claro/escuro, desktop/mobile | Sonnet: implementação (SSH VM dev) | `scripts/browser-check/check.mjs`, `docs/infra/ssh-workflow.md` |
| 15 | Relatório pós-sprint (`SPRINT-035-...-report.md`) | Sonnet: implementação | — |

## Coerência de Design (DESIGN.md)

Esta sprint estende o sistema Analyst Console introduzido na Sprint 34 a mais 4 telas, sem alterar
regras já fixadas (Tabular Money Rule, Flat Ledger Rule, One Meaning Rule). Introduz um padrão novo —
o Drawer — que passa a fazer parte do vocabulário do sistema e deve ser documentado em `DESIGN.md`
como componente reutilizável (não específico de uma tela), já que sprints futuras do épico podem
precisar do mesmo padrão. Segue também o precedente já estabelecido pela Sprint 34 em Dashboards de
migrar a camada de KPI/resumo mas manter funil/accordion no sistema visual atual — evita reabrir essa
decisão tela a tela.

## Testes previstos

- `Drawer`: abre/fecha via prop `open`; `onClose` chamado ao clicar no backdrop, no botão fechar e ao
  pressionar Escape; clique dentro do painel não fecha; `children` não é renderizado quando fechado
  (prova de que as queries dos filhos não disparam à toa); `role="dialog"`/`aria-modal`/foco inicial.
- `CategorizationReviewPage`: botão "Gerenciar categorias" abre o drawer; o CRUD de categoria dentro
  do drawer funciona (criar/editar/excluir grupo e subcategoria — smoke test, detalhe já coberto em
  `CategoriasPage.test.tsx`); fechar o drawer.
- `ConfiguracoesPage`: botão "Gerenciar contas" abre o drawer com `AccountManagementPage`; Perfil e
  Competência de Salário continuam funcionando inline, sem regressão.
- `NaturezaPage`: tiles com `KpiTile` abrem/fecham o funil corretamente (equivalente ao
  `aria-expanded` anterior); funil/accordion sem regressão de comportamento.
- `ProtectedPage`: nav com 8 abas, sem "Categorias"; nenhuma outra aba muda de posição/comportamento.
- `NaturezaPage.test.tsx` e `CategoriasPage.test.tsx` rodados a cada mudança em
  `SubcategoryGroupTable.tsx` — nenhuma regressão de dado/comportamento, só apresentação.
- Cobertura: `npm run test:coverage` ≥80% em `Drawer` e na lógica de integração botão→drawer→conteúdo
  nas 2 telas que ganham drawer.

## Impacto no roadmap

Não cria épico novo — continua o E10, já registrado em `docs/roadmap.md`. Ao final da sprint (após
aprovação do relatório e deploy), o doc-updater atualiza a linha do E10 para refletir Categorizar,
Categorias, Configurações e Natureza como concluídas, e o backlog restante do épico passa a ser Ativos,
Investimentos, Passivos, Orçamento, Login.

Não é checkpoint de auditoria estrutural (Sprint 34 foi a 5ª desde a última verificação; a contagem
recomeça a partir dela — confirmar contador exato em `docs/roadmap.md` § Auditoria estrutural ao
atualizar a documentação viva no fim da sprint).

## Riscos / dependências

- **`SubcategoryGroupTable` compartilhado entre `CategoriasPage` (agora no drawer) e `NaturezaPage`**
  — maior risco técnico da sprint. Mitigado por migrar as duas telas juntas (decisão do CEO), sem
  precisar de flag de variante temporária. Rodar `NaturezaPage.test.tsx` a cada edição no componente.
- **Testes que buscam o `<h2>` removido** de `CategoriasPage.tsx` e `AccountManagementPage.tsx` (título
  passa a vir do `Drawer`) — atualizar `getByRole("heading", ...)` correspondentes.
- **`PeriodFilter.tsx` não deve ser alterado** — compartilhado por Categorizar, Natureza, Orçamento e a
  auditoria de saldo em `AccountManagementPage`; só estilização via CSS descendente (`.ac-toolbar
  select`), nunca mudança de props/comportamento do componente.
- **Drawer estreito (560px) com tabelas largas** — a tabela de auditoria de saldo por conta em
  `AccountManagementPage` tem até 12 colunas (uma por mês); mitigado pelo scroll horizontal interno já
  existente (`.ac-table-wrap { overflow-x: auto }`), sem necessidade de alargar o drawer.
- Nenhuma migration, nenhuma mudança de lógica de cálculo ou de regra de categorização — reduz risco
  de regressão de dado real na VM de dev (única VM rodando o app, com dados reais da família
  sincronizados).
- Deploy segue o fluxo padrão do projeto (relatório → aprovação do CEO → deploy manual na VM de dev) —
  não incluído nesta sprint até o relatório ser aprovado.
