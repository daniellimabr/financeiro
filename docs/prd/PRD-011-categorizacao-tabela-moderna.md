# PRD-011: Categorização — tabela moderna

- **Status:** aprovado
- **Épico relacionado:** E3 Categorização (polish) — ver [docs/roadmap.md](../roadmap.md)
- **Sprint(s):** [SPRINT-011](../sprints/SPRINT-011-categorizacao-tabela-moderna-plan.md)

## Problema

A funcionalidade da tela de Categorização (`CategorizationReviewPage.tsx`)
está completa desde a Sprint 10 — paginação, filtros (período, tipo,
status, associado a ativo, categoria/grupo) e aprovação em lote já
funcionam. O que falta é visual/interação: a tabela reaproveita a classe
`.dash-table`, que o próprio `DESIGN.md` documenta como *"the terminal,
plainest level of the funnel by design"* — pensada para linhas de leitura
passiva em drill-downs (Dashboard, Ativos, Passivos). A tela de
Categorização não é um drill-down terminal: é a superfície de trabalho
primária onde o usuário revisa, corrige e aprova transações, muitas vezes
em sequência longa (chegou a ter 929 pendências reais na VM de dev). Usar
o estilo "terminal" ali é um descompasso herdado, não uma escolha
deliberada.

O ponto mais concreto da dor: o seletor de categoria de cada linha é um
`<select>` nativo do navegador listando as 51 subcategorias das 15
categorias do sistema, sem nenhum agrupamento visual — o usuário tem que
rolar uma lista longa e sem hierarquia toda vez que corrige uma sugestão.

## Escopo

- **Incluído:**
  - Novo componente compartilhado `CategoryCombobox`
    (`frontend/src/components/CategoryCombobox.tsx`): combobox buscável,
    com agrupamento visual por categoria (grupo), navegação por teclado
    (setas para mover o destaque, Enter confirma, Escape fecha sem
    aplicar, digitação filtra em tempo real por texto — mesmo padrão ARIA
    combobox+listbox: `role="combobox"`, `aria-expanded`,
    `aria-activedescendant`, popup com `role="listbox"`/`role="option"`).
    Controlado (`value`/`onChange`), sem mutation própria — cada tela que
    o usa decide se a mudança é aplicada na hora ou fica em estado local
    até uma ação de confirmação.
  - `TransactionEditCells.CategorySelectCell` passa a usar
    `CategoryCombobox` por dentro, mantendo a mesma API externa e o mesmo
    comportamento de mutation imediata que já tem hoje — efeito colateral
    esperado: os drill-downs de Dashboard/Ativos/Passivos (que já usam
    `CategorySelectCell`) ganham o combobox automaticamente, sem precisar
    mudar nada nos componentes que os hospedam.
  - `CategorizationReviewPage.tsx`: o `<select>` de categoria inline
    (hoje duplicando a lógica de rótulo de `CategorySelectCell`) passa a
    usar `CategoryCombobox`, preservando a lógica de estado local
    (`selectedSubcategory`) que a aprovação em lote depende — a seleção
    só é aplicada de fato quando a linha é confirmada individualmente ou
    quando "Aprovar marcadas" roda.
  - Extração de `subcategoryLabel(subcategoryId, subcategories, groups)`
    (hoje duplicada byte-a-byte em `TransactionEditCells.tsx` e
    `CategorizationReviewPage.tsx`) para `frontend/src/utils/transactionEdit.ts`,
    usada tanto para montar as opções do combobox quanto para exibir o
    valor selecionado.
  - Badge de status por linha (Pendente/Confirmada), usando só tokens já
    existentes em `index.css` — Confirmada com `--accent`/`--accent-bg`
    (mesma linguagem de "estado ativo" já usada em outros pontos do app);
    Pendente neutro, com `--border`/`--text`, sem cor de destaque. Não
    reutiliza a cor terracota (despesa) para nenhum dos dois estados —
    essa cor é exclusiva de despesa pela "One Meaning Rule" do
    `DESIGN.md`. É o único idioma visual novo desta sprint além do
    combobox.
  - Polish de linha na tabela de Categorização: hover, espaçamento e
    alinhamento da coluna de checkbox, via classe nova aditiva sobre
    `.dash-table` (não um fork da tabela) — aplicado só a esta tela.
    `TransactionTipoIcon` mantém a posição atual ao lado do valor
    (decisão já validada na Sprint 10, não reaberta aqui).
  - Testes automatizados (meta ≥80% de cobertura nos módulos tocados):
    `CategoryCombobox.test.tsx` novo (teclado, filtro por digitação,
    agrupamento, acessibilidade, `disabled`); primeiro
    `TransactionEditCells.test.tsx` direto (hoje só testado indiretamente
    via páginas que o usam); atualização de `CategorizationReviewPage.test.tsx`
    e auditoria de `DashboardsPage.test.tsx`/`LiabilitiesPage.test.tsx`
    por asserts que dependiam do `<select>` nativo.

- **Fora de escopo (explicitamente):**
  - Combobox para o seletor de Ativo (`AssetSelectCell`) — a lista de
    ativos por usuário é pequena (unidades, não dezenas), não justifica o
    mesmo investimento de UI que a lista de 51 subcategorias. Continua
    `<select>` nativo. Reavaliar só se um usuário acumular muitos ativos.
  - Generalizar o padrão de combobox para os outros `<select>` da tela
    (filtros de período/tipo/status/ativo associado/categoria na barra de
    filtro) — são listas curtas e fixas, `<select>` nativo continua
    adequado.
  - Restilizar o chrome das tabelas de drill-down (Dashboard, Ativos,
    Passivos) — continuam "o nível mais plano do funil" por design; só o
    seletor de categoria dentro delas muda (via `CategorySelectCell`), a
    tabela em volta não.
  - "Camada Ativo no funil Categoria>Tipo>Transação" (ideia registrada em
    `docs/roadmap.md` na revisão pós-Sprint 10) — já marcada como
    candidata para sessão de `/plan` própria e futura; não entra aqui.
  - Seleção de categoria em massa via combobox (aplicar uma categoria a
    várias linhas marcadas de uma vez) — o fluxo de aprovação em lote
    continua como está: cada linha mantém sua própria categoria, só a
    ação de aprovar é em lote.
  - Qualquer mudança de backend/API — confirmado que não é necessária
    (ver "Dados e modelo").

## Critérios de aceite

1. Dada a tela de Categorização, quando o usuário clica ou navega por
   teclado até o campo de categoria de uma linha, então um combobox abre
   mostrando as subcategorias agrupadas visualmente por categoria (grupo),
   sem precisar rolar uma lista plana de 51 itens.
2. Dado o combobox de categoria aberto, quando o usuário digita, então a
   lista filtra em tempo real por texto (nome da categoria e/ou
   subcategoria), sem diferenciar maiúsculas/acentos.
3. Dado o combobox de categoria aberto, quando o usuário usa as setas para
   navegar e Enter para confirmar, então a opção destacada é selecionada e
   o combobox fecha; Escape fecha sem aplicar mudança.
4. Dada uma linha **pendente** na tela de Categorização, quando o usuário
   escolhe uma categoria no combobox, então a escolha fica em estado
   local (não é salva ainda) até a linha ser confirmada individualmente
   ou incluída em "Aprovar marcadas" — mesmo comportamento de hoje, sem
   regressão.
5. Dada uma linha **já confirmada**, quando o usuário escolhe uma nova
   categoria no combobox, então a mudança é salva imediatamente (mesmo
   comportamento de hoje via `useSetCategory`).
6. Dado o mesmo `CategoryCombobox` usado no drill-down de transações do
   Dashboard/Ativos/Passivos (via `CategorySelectCell`), quando o usuário
   escolhe uma categoria ali, então o comportamento de mutation imediata
   permanece idêntico ao que existe hoje, sem exigir mudança nos
   componentes que hospedam esse drill-down.
7. Dada a lista de transações, quando o usuário olha uma linha, então o
   status (Pendente/Confirmada) aparece como um badge visual (não só
   texto simples), usando cores neutras/accent já existentes no design
   system — nunca a cor terracota reservada para despesa.
8. Dado o combobox de categoria, quando testado com leitor de tela ou
   navegação só por teclado, então expõe `role="combobox"`,
   `aria-expanded`, `aria-activedescendant` e um popup `role="listbox"`
   com `role="option"` em cada item, preservando o `aria-label` já usado
   hoje (`Categoria de {descrição}`) para não quebrar automação/testes
   existentes que dependem dele.
9. Dado o CI, quando a suíte roda, então os testes novos e atualizados
   (frontend) passam com cobertura ≥80% nos módulos tocados, sem
   regressão nos testes existentes de `DashboardsPage`/`LiabilitiesPage`.

## Regras de negócio

- O `CategoryCombobox` nunca decide sozinho se a mudança de categoria é
  imediata ou bufferizada — isso continua sendo responsabilidade de quem
  o usa (`CategorySelectCell` decide imediato; `CategorizationReviewPage`
  decide bufferizado até confirmação). O componente é puramente
  controlado (`value`/`onChange`).
- O agrupamento e o rótulo de cada opção (`"{grupo} / {subcategoria}"`)
  usam exatamente a mesma função (`subcategoryLabel`, extraída e
  compartilhada) em todo lugar que exibe uma categoria — nunca duas
  lógicas de rótulo divergentes coexistindo.
- Cor de status nunca reutiliza a cor semântica de despesa (terracota) —
  "One Meaning Rule" do `DESIGN.md` permanece válida sem exceção.

## Dados e modelo

Nenhuma mudança de schema, migration, endpoint ou contrato de API. Todos
os dados que o `CategoryCombobox` precisa (`CategoryGroup[]`,
`Subcategory[]`) já são carregados hoje em `CategorizationReviewPage.tsx`
via `useCategoryGroups`/`useSubcategories`, e nos drill-downs via os
mesmos hooks já usados por `CategorySelectCell`. Esta é uma mudança
inteiramente de frontend.

## Segurança

Sem superfície nova: nenhum endpoint novo, nenhum dado novo trafegado,
nenhuma mudança de autenticação/autorização. O combobox só reorganiza a
apresentação de dados já buscados com o isolamento por usuário existente.

## Fora de escopo / decisões adiadas

- Combobox para seletor de Ativo — ver "Escopo".
- Generalização do padrão de combobox para outros `<select>` do app — ver
  "Escopo".
- Restilizar tabelas de drill-down além do seletor de categoria — ver
  "Escopo".
- "Camada Ativo no funil Categoria>Tipo>Transação" — candidata registrada
  em `docs/roadmap.md`, sessão de `/plan` própria e futura.
- Seleção de categoria em massa via combobox — ver "Escopo".

## Referências

- [docs/roadmap.md](../roadmap.md) (entrada da Sprint 11)
- [PRD-007 — Categorização (rework), Gestão de Contas](PRD-007-categorizacao-gestao-contas.md)
  (origem da `CategorizationReviewPage.tsx` atual)
- [PRD-010 — Revisão de UX e Gestão de Passivos](PRD-010-revisao-ux-e-passivos.md)
  (indicador visual débito/crédito, edição inline compartilhada entre
  telas — mesmo padrão de reaproveitamento de componente usado aqui)
- `DESIGN.md` (raiz do repo) — One Meaning Rule, One Button Rule, Flat
  Ledger Rule, dois níveis de raio (8px controles / 12px containers)
