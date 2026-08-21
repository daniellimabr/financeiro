# PRD-035: Redesign visual "Analyst Console" — Categorizar, Categorias, Configurações, Natureza

- **Status:** ✅ implementado e aprovado pelo CEO em 2026-08-21
- **Épico relacionado:** E10 — Redesign visual (Analyst Console) (ver `docs/roadmap.md`). Segunda
  sprint do épico — a Sprint 34 cobriu fundação (tokens/tipografia/shell) + Dashboard.
- **Sprint(s):** [SPRINT-035-redesign-analyst-console-categorizar-configuracoes-natureza-plan.md](../sprints/SPRINT-035-redesign-analyst-console-categorizar-configuracoes-natureza-plan.md)

## Problema

Desde a Sprint 34, o app tem dois sistemas visuais coexistindo: Dashboard já migrado para "Analyst
Console" (`--ac-*`, Inter, KPIs com delta+sparkline), e as demais 8 telas do sidebar ainda no sistema
antigo (`.dash-page`, `.dash-table`, `.dash-filter`). O CEO pediu para continuar o épico priorizando
Categorizar (tela de maior uso diário — fila de revisão de transações) e Configurações.

Durante o planejamento, o CEO também observou que **Categorias** (CRUD de categorias/subcategorias,
hoje aba própria do sidebar) faz mais sentido como parte do fluxo de Categorizar do que como uma tela
separada — é uma ferramenta de apoio à categorização, não um destino de navegação independente.

## Decisão do CEO

1. **Categorias deixa de ser aba própria do sidebar.** Vira um botão "Gerenciar categorias" dentro da
   tela Categorizar, que abre um painel lateral (drawer) sobre a tela, contendo o CRUD que hoje é
   `CategoriasPage.tsx`. Remove 1 item do menu (de 9 para 8 abas).
2. **Configurações adota o mesmo padrão de drawer para Gestão de Contas.** A seção "Gestão de Contas"
   (hoje embutida inline, reaproveitando `AccountManagementPage.tsx` inteiro) vira um botão "Gerenciar
   contas" que abre um drawer com o mesmo conteúdo. Configurações mantém inline só Perfil e
   Competência de Salário.
3. **Natureza entra na sprint junto com Categorias.** As duas telas compartilham o componente
   `SubcategoryGroupTable`. Em vez de introduzir uma prop de variante temporária (uma tela migrada,
   outra não) ou deixar a tabela presa no estilo antigo dentro do novo drawer de Categorias, o CEO
   decidiu migrar as duas de uma vez: `SubcategoryGroupTable` sai diretamente no novo sistema, sem
   flag, e tanto `CategoriasPage` (agora no drawer) quanto `NaturezaPage` (continua aba própria) saem
   desta sprint no mesmo padrão visual.

**Decisão de escopo confirmada com o CEO nesta sessão:** Orçamento fica fora — não compartilha
componente crítico com as demais 4 telas desta sprint, entra em sprint futura própria do épico E10.
Login também fica fora (fluxo de autenticação, sem urgência de uso diário).

## Escopo

### Incluído

1. **Componente novo `frontend/src/components/Drawer.tsx`**: painel lateral genérico e reutilizável
   (`open`/`onClose`/`title`/`children`), via `createPortal` (mesmo padrão já usado por
   `CategoryCombobox.tsx`). Fecha em clique no backdrop, botão "Fechar" e tecla Escape. Não monta os
   filhos quando fechado (evita disparar queries de React Query à toa). Serve aos dois novos usos
   desta sprint e a sprints futuras do épico que precisem do mesmo padrão.
2. **CSS compartilhado novo** em `frontend/src/index.css`, namespace `--ac-*`: `.ac-drawer-*` (painel,
   backdrop, cabeçalho); `.ac-btn`/`.ac-btn-primary`/`.ac-btn-ghost`/`.ac-btn-danger` (primeiro
   vocabulário de botão de ação do Analyst Console — Dashboards não precisou, só tinha tiles/toggles);
   `.ac-form-row` (campos empilhados de formulário, distinto de `.ac-toolbar` que é para filtros).
3. **`frontend/src/pages/CategorizationReviewPage.tsx`**: migração visual completa para Analyst
   Console (`ac-page`, `ac-toolbar`, `ac-txn-table`) + botão "Gerenciar categorias" que abre o drawer
   com `CategoriasPage`.
4. **`frontend/src/pages/CategoriasPage.tsx`**: deixa de ser roteada como aba própria; passa a ser
   montada só dentro do drawer. Remove cabeçalho próprio (título vem do `Drawer`).
5. **`frontend/src/components/SubcategoryGroupTable.tsx`**: migrado diretamente para o sistema visual
   Analyst Console (sem prop de variante — os dois consumidores migram juntos nesta sprint).
6. **`frontend/src/pages/NaturezaPage.tsx`**: migração visual seguindo o mesmo corte já estabelecido
   pela própria `DashboardsPage.tsx` na Sprint 34 — a linha de KPIs (tiles Fixo/Variável/Eventual)
   migra para o componente `KpiTile` já existente; o funil/accordion (Natureza → Grupo → Subcategoria
   → transações) permanece no sistema visual atual, mesmo padrão que Dashboards manteve para seu
   próprio funil de categoria. `KpiTile` ganha uma prop opcional `ariaExpanded` (aditiva, não quebra
   os usos existentes em Dashboards) para preservar a semântica de "funil aberto" que o tile atual
   expõe hoje.
7. **`frontend/src/pages/ConfiguracoesPage.tsx`**: migração visual completa; remove a seção "Gestão de
   Contas" inline, substitui por botão "Gerenciar contas" que abre o drawer com
   `AccountManagementPage`. Mantém inline, só restilizadas: Perfil e Competência de Salário.
8. **`frontend/src/pages/AccountManagementPage.tsx`**: migração visual completa (maior peça de restyle
   da sprint — baseline de saldo, tabela de auditoria por conta, holdings). Remove cabeçalho próprio.
9. **`frontend/src/pages/ProtectedPage.tsx`**: remove a aba "Categorias" de `NAV_ITEMS`/`Tab`/ícones.
   Nenhuma outra aba muda de posição.
10. **`DESIGN.md`**: nova entrada documentando o padrão de Drawer e o corte "migrar KPIs, manter
    funil/accordion no sistema antigo" — já é um padrão repetido 2x (Dashboards, Natureza) e deve
    orientar as sprints seguintes do épico.

### Fora de escopo (explicitamente)

- Ativos, Investimentos, Passivos, Orçamento, Login — continuam no sistema visual atual até suas
  próprias sprints do épico E10.
- Qualquer mudança de lógica de negócio/cálculo/regra de categorização — esta sprint é estritamente
  visual/estrutural de front-end e de reorganização de navegação (drawers), nenhuma regra validada em
  sprints anteriores é reaberta.
- Migrar o funil/accordion de Natureza (`.dash-funnel`/`.dash-accordion`) para Analyst Console — segue
  o precedente da Sprint 34, candidato a sprint futura do épico se o CEO priorizar.
- Focus-trap de biblioteca no `Drawer` — foco inicial + Escape é suficiente, consistente com o nível
  de rigor de acessibilidade já usado no resto do app.
- Alterar `frontend/src/components/PeriodFilter.tsx` — é compartilhado por Categorizar, Natureza,
  Orçamento e a auditoria de saldo em `AccountManagementPage`; qualquer mudança de comportamento nele
  vazaria para telas fora de escopo. Só estilização via CSS descendente.

## Critérios de aceite

1. `Drawer.tsx` existe como componente isolado, testado: abre/fecha via prop, fecha em backdrop/botão
   X/Escape, não fecha em clique interno, não monta `children` quando fechado.
2. Sidebar (`ProtectedPage`) tem 8 abas (sem "Categorias"); nenhuma outra aba muda de posição/label.
3. Na tela Categorizar: botão "Gerenciar categorias" abre um drawer com o CRUD completo de categorias
   e subcategorias (criar/editar/excluir grupo e subcategoria, guards de exclusão quando em uso) —
   comportamento idêntico ao que `CategoriasPage.tsx` tinha como aba própria, sem regressão funcional.
4. Na tela Configurações: botão "Gerenciar contas" abre um drawer com o conteúdo completo de
   `AccountManagementPage.tsx` (contas Pluggy, apelido, sync, saldo inicial, vínculo de investimento,
   holdings, excluir conta) — sem regressão funcional. Perfil e Competência de Salário continuam
   inline na página.
5. `SubcategoryGroupTable` usado tanto dentro do drawer de Categorias quanto em `NaturezaPage` está no
   sistema visual Analyst Console; `NaturezaPage.test.tsx` passa sem regressão (mesma cobertura de
   antes, migração é só de apresentação).
6. `NaturezaPage`: os 3 tiles (Fixo/Variável/Eventual) usam `KpiTile` com sparkline e mantêm o
   comportamento de abrir/fechar o funil ao clicar (incluindo o estado equivalente ao `aria-expanded`
   anterior); o funil/accordion abaixo continua funcionando sem mudança visual.
7. Nenhuma mudança de valor/cálculo em nenhuma das 4 telas — dados exibidos idênticos aos de antes da
   migração, para o mesmo usuário/período.
8. Suíte 100% verde (`npm test`), lint sem erros (`npm run lint`), `npx tsc -b` sem erros,
   `npm run test:coverage` ≥80% em lógica de negócio nova/alterada (`Drawer`, integração
   botão→drawer→conteúdo).
9. `DESIGN.md` atualizado reflete o padrão de Drawer e a decisão de manter funil/accordion no sistema
   antigo.
10. Browser-check (`scripts/browser-check/`) capturado em claro/escuro, desktop/mobile, para as 4
    telas e os 2 drawers — sem overflow, sem quebra de layout.

## Regras de negócio

- O `Drawer` nunca mantém os filhos montados enquanto fechado — cada abertura dispara as queries de
  dados normalmente (dados sempre atuais ao abrir, não um cache "congelado" da última abertura).
- Delta/sparkline dos tiles de Natureza seguem a mesma regra de delta já estabelecida na Sprint 34
  para `KpiTile` (período atual vs. imediatamente anterior) — nenhuma regra nova de cálculo.
- Guards de exclusão de categoria/subcategoria (400 quando em uso por transação/regra/orçamento)
  continuam exatamente como estão — só o contêiner visual (drawer em vez de página) muda.

## Dados e modelo

- Nenhuma migration de schema prevista.
- Nenhum endpoint novo — todas as 4 telas já têm os dados de que precisam via hooks existentes.
- Nenhum dado sensível novo, nenhum secret.

## Segurança

- Sem mudança de isolamento por usuário — puramente front-end, mesmas chamadas de API já
  autenticadas/filtradas por `user_id`.

## Referências

- [PRD-034](PRD-034-redesign-analyst-console-fundacao-dashboard.md) — origem do épico E10, sistema de
  tokens/componentes (`KpiTile`, paleta, tipografia) reaproveitado aqui.
- [PRD-011](PRD-011-categorizacao-tabela-moderna.md) — origem da tabela moderna de Categorizar
  (`CategoryCombobox`), não reaberta, só restilizada.
- [PRD-030](PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md) — origem funcional da tela
  Categorias (CRUD por usuário) e de Orçamento; CRUD preservado integralmente, só muda o contêiner de
  navegação.
- [PRD-015](PRD-015-configuracoes-competencia-salario-saldo-acumulado.md) — origem funcional de
  Configurações e da fusão com Gestão de Contas.
- [DESIGN.md](../../DESIGN.md) — seção "Analyst Console (Sprint 34, épico E10)", base visual desta
  sprint.
