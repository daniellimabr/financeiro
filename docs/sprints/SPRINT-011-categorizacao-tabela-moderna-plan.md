# SPRINT-011: Categorização — tabela moderna — Plano

- **PRD(s):** [PRD-011-categorizacao-tabela-moderna](../prd/PRD-011-categorizacao-tabela-moderna.md)
- **Data do plano:** 2026-08-15

## Objetivo da sprint

Ao final, a tela de Categorização tem um combobox buscável e agrupado por
categoria no lugar do `<select>` nativo de 51 itens; os drill-downs de
Dashboard/Ativos/Passivos herdam o mesmo combobox automaticamente (via
`CategorySelectCell`); cada linha mostra o status (Pendente/Confirmada)
como badge visual; a tabela ganha hover/espaçamento/alinhamento
condizentes com o resto do design system — tudo sem mudança de
backend/API e sem tocar no chrome das tabelas de drill-down.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Extrair `subcategoryLabel(subcategoryId, subcategories, groups)` para `frontend/src/utils/transactionEdit.ts`; atualizar os dois call sites duplicados hoje | Sonnet: implementação | [transactionEdit.ts](../../frontend/src/utils/transactionEdit.ts); [TransactionEditCells.tsx:78-83](../../frontend/src/components/TransactionEditCells.tsx); [CategorizationReviewPage.tsx:77-82](../../frontend/src/pages/CategorizationReviewPage.tsx) |
| 2 | Construir `CategoryCombobox.tsx` isolado: props `{groups, subcategories, value, onChange, ariaLabel, disabled?}`, agrupamento visual por grupo, filtro por digitação, navegação por teclado (setas/Enter/Escape), padrão ARIA combobox+listbox, popup flat (sem sombra, borda `--border`, raio 8px) | Sonnet + skill impeccable | `DESIGN.md` (One Meaning/Button/Flat Ledger Rules); [TransactionEditCells.tsx](../../frontend/src/components/TransactionEditCells.tsx) (rótulo/estrutura de dados atual) |
| 3 | CSS novo em `index.css`: classe(s) do combobox (trigger, popup, opção, cabeçalho de grupo) + classe(s) do badge de status (`.status-badge--confirmed`/`--pending`, tokens `--accent`/`--accent-bg`/`--border`/`--text`, sem terracota) | Sonnet + skill impeccable | [index.css:440-840](../../frontend/src/index.css) |
| 4 | `TransactionEditCells.CategorySelectCell`: trocar o `<select>` interno por `CategoryCombobox`, mantendo API externa e mutation imediata idênticas; rodar suíte existente de `DashboardsPage.test.tsx`/`LiabilitiesPage.test.tsx` para pegar quebras de interação | Sonnet: implementação | [TransactionEditCells.tsx:66-104](../../frontend/src/components/TransactionEditCells.tsx) |
| 5 | `CategorizationReviewPage.tsx`: trocar o `<select>` inline (linhas 258-279) por `CategoryCombobox`, preservando `selectedSubcategory`/fluxo de aprovação em lote; badges de status reais (`isPendente` → classe do badge) | Sonnet + skill impeccable | [CategorizationReviewPage.tsx](../../frontend/src/pages/CategorizationReviewPage.tsx) |
| 6 | Polish visual da tabela de Categorização: hover de linha, espaçamento, alinhamento da coluna de checkbox — classe aditiva sobre `.dash-table`, só nesta tela | Sonnet + skill impeccable | [index.css:732-827](../../frontend/src/index.css) |
| 7 | Testes: `CategoryCombobox.test.tsx` novo (teclado, filtro, agrupamento, acessibilidade, `disabled`); `TransactionEditCells.test.tsx` novo (primeira cobertura direta); atualizar `CategorizationReviewPage.test.tsx` (interação de combobox no lugar de `selectOptions`, badge de status, fluxo de aprovação em lote de ponta a ponta); auditar `DashboardsPage.test.tsx`/`LiabilitiesPage.test.tsx` por asserts dependentes do `<select>` nativo | Sonnet + skill tdd-workflow | testes existentes das 4 páginas |
| 8 | Validação manual via skill `run` contra dado real da VM de dev (fila com centenas de pendências, mesma escala do achado de performance da Sprint 6) — confirmar que renderizar o combobox por linha não reintroduz lentidão | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md) |
| 9 | `scripts/browser-check/check-categorizacao.mjs` (já existe, da correção pós-Sprint 6) atualizado para cobrir o combobox (abrir, digitar, selecionar por teclado) e o badge de status | Sonnet: implementação | [scripts/browser-check/check-categorizacao.mjs](../../scripts/browser-check/check-categorizacao.mjs) |
| 10 | Atualizar docs vivos (`OVERVIEW.md`, `directory-structure.md`, `roadmap.md` fechando Sprint 11) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md, roadmap.md |
| 11 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários/componente (Vitest):** `CategoryCombobox` — abrir via clique/teclado, filtro por digitação (case/acento-insensível), navegação por setas, Enter confirma, Escape cancela, seleção por clique direto, cabeçalhos de grupo não selecionáveis, `aria-expanded`/`aria-activedescendant`/`role`s corretos, `disabled` suprime interação.
- **Integração:** `CategorySelectCell` com o combobox por dentro — seleção dispara `useSetCategory` imediatamente, igual ao comportamento anterior do `<select>`. `CategorizationReviewPage` — seleção numa linha pendente fica em estado local até confirmação/aprovação em lote; seleção numa linha confirmada muta na hora; badge de status renderiza a classe certa para pendente/confirmada.
- **Regressão:** suítes existentes de `DashboardsPage.test.tsx`/`LiabilitiesPage.test.tsx` (drill-downs que usam `CategorySelectCell`) continuam 100% verdes após a troca do `<select>` pelo combobox.
- Meta ≥80% cobertura nos módulos tocados, mesmo padrão das sprints anteriores. Sem testes de backend — sprint é frontend-only (ver PRD-011, "Dados e modelo").

## Impacto no roadmap

Fecha o item "Categorização: tabela moderna" (E3, polish) que ficava em
aberto desde a Sprint 6. Não fecha o épico E3 sozinho (E3 já estava
concluído desde a Sprint 4, esta sprint é polish sobre ele). Não introduz
nenhuma pendência nova para sprints futuras além do que já estava
registrado (combobox de Ativo e generalização do padrão para outros
`<select>`s ficam como candidatos explicitamente adiados, não
comprometidos).

## Riscos / dependências

- **`CategorySelectCell` é usado por 3 telas hoje** (Dashboard, Ativos,
  Passivos, via drill-down) além da própria Categorização — trocar seu
  `<select>` interno por `CategoryCombobox` sem mudar a API externa é o
  que evita alterar esses 3 call sites, mas a suíte de testes de cada uma
  precisa continuar verde (mesmo risco já mitigado em extrações
  anteriores como `PeriodFilter`/`CardSparkline`/`TrendChart` nas
  Sprints 8/9/10).
- **Padrão de componente novo no design system** — `CategoryCombobox` não
  tem precedente (`DESIGN.md` não documenta nenhum combobox hoje).
  Diferente de mudanças de cor/tipografia anteriores (que passaram por
  comparação visual renderizada com o CEO), esta é uma decisão de
  interação já aprovada diretamente pelo CEO na sessão de planejamento —
  não repetir o processo de comparação visual, mas vale rodar
  `/impeccable audit` ao final antes de fechar, como de praxe em sprints
  que tocam frontend.
- **51 subcategorias renderizadas por combobox, potencialmente uma
  instância por linha visível** — a Sprint 6 já teve um N+1 real nesta
  mesma tela; task 8 (validação manual contra fila grande na VM de dev)
  existe especificamente para pegar qualquer degradação de performance
  antes de fechar a sprint, não depois.
- **Mudança de `<select>` nativo para combobox custom quebra testes que
  usam `userEvent.selectOptions`** — esperado e coberto pela task 7;
  qualquer teste de `DashboardsPage`/`LiabilitiesPage` que dependa desse
  padrão de interação precisa ser atualizado, não só os da própria
  Categorização.
