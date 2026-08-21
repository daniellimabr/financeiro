# PRD-036a: Redesign visual "Analyst Console" — Ativos, Passivos, Orçamento, Login

- **Status:** implementado
- **Épico relacionado:** E10 — Redesign visual (Analyst Console) (ver `docs/roadmap.md`). Terceira
  sprint do épico — a Sprint 34 cobriu fundação (tokens/tipografia/shell) + Dashboard, a Sprint 35
  cobriu Categorizar/Categorias(→Drawer)/Configurações/Natureza.
- **Sprint(s):** [SPRINT-036-redesign-analyst-console-restante-epico10-plan.md](../sprints/SPRINT-036-redesign-analyst-console-restante-epico10-plan.md)
- **PRD irmão:** [PRD-036b](PRD-036b-redesign-analyst-console-investimentos.md) — revamp de
  Investimentos, mesma sprint, especificado à parte porque depende de uma sessão de avaliação de
  layout que não pode ser antecipada aqui.

## Problema

Depois da Sprint 35, restam 5 telas no sistema visual original: Ativos, Passivos, Orçamento, Login e
Investimentos. O CEO decidiu fazer o bundle das 5 na Sprint 36 (mesmo precedente da Sprint 35, que
migrou 4 telas numa sprint só), mas separou o tratamento: Investimentos é um revamp de conteúdo, as
outras 4 são reskins diretos — mesmo padrão mecânico já usado 3x no épico. Este PRD cobre só as 4
telas de reskin.

## Decisão do CEO

1. **Bundle de 5 telas na Sprint 36** (não dividir em sprints separadas por tela).
2. **Ativos, Passivos, Orçamento e Login seguem o padrão de reskin já estabelecido** — camada de
   topo (toolbar/cards/diálogos) migra para `.ac-*`, funil de drilldown fica no sistema antigo
   ("KPI migra, funil fica", precedente repetido em Dashboards e Natureza).
3. **Investimentos é tratado à parte** (PRD-036b), com uma sessão de avaliação de layout antes da
   especificação final.

## Escopo

### Incluído

1. **`frontend/src/components/AcItemCard.tsx`** (nome definitivo a confirmar na execução):
   componente novo compartilhado entre Ativos e Passivos, extraído porque as duas telas duplicam
   hoje a mesma estrutura de card (`.dash-tile`: tipo, valor, nome, tag, sparkline opcional, grupo
   de botões de ação via `children`) — mesmo raciocínio que gerou `SubcategoryGroupTable`
   compartilhado entre Categorias/Natureza na Sprint 35. Cobre também a lista secundária de itens
   baixados/quitados (mesma forma, sem sparkline/menos botões).
2. **`frontend/src/pages/AssetsPage.tsx`**: migração visual completa — toolbar (`.ac-toolbar`),
   toggle (`.ac-seg`), grid de cards via `AcItemCard`, diálogos (criar/editar, vender) viram
   `role="dialog" className="ac-panel"` + `<form className="ac-form-row">`. Funil de drilldown
   (`.dash-funnel`, accordion de transações vinculadas) e o componente `Row` importado de
   `DashboardsPage.tsx` **não mudam**.
3. **`frontend/src/pages/LiabilitiesPage.tsx`**: mesma receita de Ativos. `RegimeToggle
   variant="ac"`. Cor do sparkline no card migrado passa a `var(--ac-bad)`; o funil (que continua
   no sistema antigo) mantém `var(--despesa)`.
4. **`frontend/src/pages/OrcamentoPage.tsx`**: migração de toolbar (só o botão "Novo orçamento") e
   diálogo de criar/editar (incluindo o toggle interno Eventual/Recorrente → `.ac-seg`). Não usa
   `AcItemCard` (não tem `.dash-tile`). Avaliar na execução se compensa uma versão `.ac-*` mínima de
   `.simple-list` (troca de tokens de cor/borda) para a tela não ficar parcialmente migrada sem uma
   fronteira de funil que justifique — decisão de execução, não de produto.
5. **`frontend/src/pages/LoginPage.tsx`**: sem mudança de estrutura JSX. Só re-tokenizar
   `.login-hero`/`.login-hero a` em `frontend/src/index.css` para `--ac-*` (`--ac-border`,
   `--ac-blue`, `--ac-blue-bg` — já existe, usado no tab ativo do sidebar) e tipografia Inter.
6. **`DESIGN.md`**: atualizar "What stays on the original system" — depois desta sprint, só
   Investimentos segue fora do namespace `--ac-*`. Registrar `AcItemCard` como componente
   reutilizável do vocabulário do sistema.

### Fora de escopo (explicitamente)

- Investimentos — coberto por PRD-036b, com sessão de avaliação de layout própria.
- Qualquer mudança de lógica de negócio/cálculo/regra (venda de ativo, quitação de passivo, tipo de
  orçamento) — esta sprint é estritamente visual/estrutural, nenhuma regra validada em sprints
  anteriores é reaberta.
- Migrar o funil/accordion de Ativos e Passivos (`.dash-funnel`/`.dash-accordion`) para Analyst
  Console — segue o precedente de Dashboards/Natureza, candidato a sprint futura se o CEO priorizar.
- Alterar `frontend/src/components/PeriodFilter.tsx` — compartilhado por várias telas fora de
  escopo; só estilização via CSS descendente, nunca mudança de props/comportamento.

## Critérios de aceite

1. `AcItemCard` existe como componente isolado, testado (render com/sem sparkline, com/sem tag,
   grupo de botões via `children`), reaproveitado por Ativos e Passivos.
2. `AssetsPage`/`LiabilitiesPage`/`OrcamentoPage` usam `.ac-*` na camada de topo (toolbar, cards,
   diálogos); os funis de drilldown de Ativos/Passivos continuam funcionando sem regressão visual ou
   funcional (venda de ativo, quitação de passivo, edição de transação vinculada).
3. `LoginPage` renderiza com tokens `--ac-*` e Inter, sem mudança de comportamento (login via Google
   OAuth continua idêntico).
4. Nenhuma mudança de valor/cálculo em nenhuma das 4 telas — dados exibidos idênticos aos de antes
   da migração, para o mesmo usuário/período.
5. Suíte 100% verde (`npm test`), lint sem erros (`npm run lint`), `npx tsc -b` sem erros,
   `npm run test:coverage` ≥80% em lógica de negócio nova/alterada (`AcItemCard` e qualquer
   integração nova).
6. `DESIGN.md` atualizado refletindo `AcItemCard` e a lista atualizada de telas ainda no sistema
   original (só Investimentos).
7. Browser-check (`scripts/browser-check/`) capturado em claro/escuro, desktop/mobile, para as 4
   telas — sem overflow, sem quebra de layout, sparklines visíveis, ícones de botão não cortados.
   `LoginPage` testada em fluxo standalone (sem sessão autenticada prévia).

## Regras de negócio

- Nenhuma regra nova — venda de ativo, quitação de passivo e criação/edição de orçamento seguem
  exatamente como estão, só o contêiner visual muda.

## Dados e modelo

- Nenhuma migration de schema prevista.
- Nenhum endpoint novo — as 4 telas já têm os dados de que precisam via hooks existentes.
- Nenhum dado sensível novo, nenhum secret.

## Segurança

- Sem mudança de isolamento por usuário — puramente front-end, mesmas chamadas de API já
  autenticadas/filtradas por `user_id`.

## Referências

- [PRD-034](PRD-034-redesign-analyst-console-fundacao-dashboard.md) — origem do épico E10, tokens e
  componentes base (`KpiTile`, paleta, tipografia).
- [PRD-035](PRD-035-redesign-analyst-console-categorizar-configuracoes-natureza.md) — precedente
  direto do padrão "KPI migra, funil fica" e da extração de componente compartilhado
  (`SubcategoryGroupTable`).
- [PRD-008](PRD-008-gestao-de-ativos.md) — origem funcional de `AssetsPage`, preservada integralmente.
- [PRD-010](PRD-010-revisao-ux-e-passivos.md) — origem funcional de `LiabilitiesPage`.
- [PRD-030](PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md) — origem funcional de
  `OrcamentoPage`.
- [DESIGN.md](../../DESIGN.md) — seção "Analyst Console", base visual desta sprint.
