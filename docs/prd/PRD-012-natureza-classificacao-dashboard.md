# PRD-012: Natureza — classificação e dashboard de visibilidade

- **Status:** aprovado
- **Épico relacionado:** E9 Natureza e projeção de custos (novo) — ver [docs/roadmap.md](../roadmap.md)
- **Sprint(s):** [SPRINT-012](../sprints/SPRINT-012-natureza-classificacao-dashboard-plan.md)

## Problema

`Subcategory.natureza` (enum `fixa`/`variavel`/`eventual`) existe no schema
desde a Sprint 2 (E4), mas ficou dormente: nenhuma tela permite editá-lo —
não existe nem uma tela de gestão de categorias no app — e nenhum dashboard
o lê. O `PRD-005` já registrava explicitamente "quebra de despesas por
`natureza`" como fora de escopo, adiada para E6 ("Fora de escopo
(explicitamente): Quebra de despesas por `natureza` (fixa/variável/eventual)
e por ativo associado... — E6"), mas as 3 sprints que fecharam E6
(6, 8, 9) nunca a entregaram.

O CEO quer visibilidade real de quanto do orçamento é fixo recorrente vs.
variável recorrente vs. eventual — hoje isso não existe em lugar nenhum do
app. Essa visibilidade também é pré-requisito direto da tela de projeção de
custos futuros (Sprint 13, planejada mas não detalhada ainda), que vai
projetar médias justamente a partir de itens fixos/variáveis recorrentes.

## Escopo

- **Incluído:**
  - Rótulos de exibição para os 3 valores do enum já existente (sem mudar
    valores no banco): `fixa` → "Fixo recorrente", `variavel` → "Variável
    recorrente", `eventual`/`null` → "Custo eventual" (default de exibição
    para subcategoria não classificada).
  - Primeira UI de edição de `natureza`: tabela de subcategorias agrupada
    por categoria, com seletor de 3 opções por linha, salvando via `PUT
    /subcategories/{id}` (endpoint já existe, sem mudança de backend nessa
    parte).
  - Novo par de agregações no backend (`app/dashboards/service.py`),
    espelhando `get_por_categoria`/`get_tendencia_por_categoria`:
    `get_por_natureza`/`get_tendencia_por_natureza`, agrupando por
    `COALESCE(Subcategory.natureza, 'eventual')`.
  - Novos endpoints `GET /dashboards/por-natureza` e `GET
    /dashboards/por-natureza/tendencia`, mesmo formato/params dos endpoints
    irmãos (`tipo`/`ano`/`mes`/`meses`, isolados por usuário).
  - Nova página "Natureza" no menu principal: dashboard de visibilidade (3
    cards — Fixo recorrente/Variável recorrente/Custo eventual — com
    total, percentual, sparkline e drill-down até transação) + a tabela de
    classificação acima, na mesma tela.
  - Testes automatizados (meta ≥80% cobertura nos módulos tocados) e
    `scripts/browser-check/check-sprint12.mjs` novo.

- **Fora de escopo (explicitamente):**
  - Projeção de custos futuros, despesas hipotéticas, gráfico
    real-vs-projetado — Sprint 13.
  - Tela de Configurações, mover "Gestão de Contas" para lá, regra de
    competência de salário — Sprint 14 (E7).
  - Natureza por transação individual (override) — decisão desta sessão de
    planejamento: classificação fica só no nível de subcategoria, herdada
    por todas as transações daquela subcategoria.
  - CRUD de criação/renomeação/exclusão de categoria/grupo — a tela nova só
    edita `natureza` de subcategorias já existentes.
  - Qualquer mudança no schema/CRUD de `subcategories` além do já existente
    — `natureza` e seu endpoint de update já existem desde a Sprint 2.

## Critérios de aceite

1. Dada a tela "Natureza", quando o usuário a abre, então vê 3 cards (Fixo
   recorrente/Variável recorrente/Custo eventual) com total do período
   filtrado, percentual e sparkline de tendência, filtráveis por ano/mês e
   por despesa/receita (mesmo padrão de filtro das outras telas de
   dashboard).
2. Dado um card de natureza, quando o usuário clica, então abre um
   drill-down (funil) das subcategorias daquela natureza no período, com
   total por subcategoria; clicar numa subcategoria mostra as transações
   (reaproveitando o mesmo painel/edição inline já usado em
   Dashboard/Ativos/Passivos).
3. Dada uma subcategoria sem `natureza` definida (`null` no banco), quando
   aparece em qualquer lugar desta tela (card, drill-down), então é
   contabilizada em "Custo eventual" — sem exigir que o CEO classifique
   tudo antes de ver o dashboard funcionando.
4. Dada a tabela de classificação de subcategorias, quando o usuário
   seleciona uma natureza diferente para uma linha, então a mudança é
   salva via `PUT /subcategories/{id}` e refletida nos cards/drill-down
   sem precisar recarregar a página (invalidação de cache).
5. Dado o CI, quando a suíte roda, então os testes novos (backend e
   frontend) passam com cobertura ≥80% nos módulos tocados, sem regressão
   nas suítes existentes de dashboards/categorias.
6. Dado qualquer endpoint novo (`/dashboards/por-natureza*`), quando
   chamado sem autenticação ou por outro usuário, então retorna 401/dados
   isolados por `user_id`, mesmo padrão de todos os endpoints de
   dashboard existentes.

## Regras de negócio

- `natureza` continua sendo um atributo da **subcategoria**, não da
  transação — toda transação herda a natureza da sua subcategoria no
  momento da consulta (sem persistir a natureza na transação).
- Subcategoria sem `natureza` (`null`) é tratada como "eventual" **só na
  agregação/exibição** (via `COALESCE` na query) — o banco continua
  permitindo `null`, sem backfill forçado. Isso não reabre a decisão da
  Sprint 2 (PRD-002: "sem valor default herdado da lista do legado"), que
  era sobre o import, não sobre como o dashboard exibe dado não
  classificado.
- Transação sem subcategoria nenhuma (`subcategory_id` nulo, "Não
  categorizado") também cai em "Custo eventual" pelo mesmo `COALESCE` —
  sem sentinel dedicado como `SEM_CATEGORIA_ID`, porque aqui o agrupamento
  é por natureza, não por subcategoria.
- Mesmas exclusões já aplicadas em todo dashboard: grupos com
  `excluir_de_totais=true` (ex.: Transferência interna) ficam fora;
  `tipo=credito` em conta de cartão de crédito nunca conta como receita
  (`_base_query`, decisão da Sprint 10).

## Dados e modelo

Nenhuma migration. `Subcategory.natureza` (`app/models/category.py`, enum
`Natureza`) e `PUT /subcategories/{id}` já existem desde a Sprint 2 com
cobertura de teste. Entidades novas: nenhuma tabela nova — só 2 dataclasses
de agregação (`NaturezaTotal`, `TendenciaNatureza`) e 2 schemas Pydantic
(`NaturezaTotalOut`, `TendenciaNaturezaOut`) em `app/dashboards/`, mesmo
padrão de `CategoriaTotal`/`CategoriaTotalOut`.

## Segurança

Sem superfície nova de dados sensíveis. Os 2 endpoints novos seguem
exatamente o padrão de isolamento por `user_id` já usado em todos os outros
endpoints de `app/dashboards/router.py` (`Depends(get_current_user)` +
filtro `user_id` em `_base_query`). Nenhum secret/credencial envolvido.

## Fora de escopo / decisões adiadas

- Projeção de custos futuros — Sprint 13.
- Tela de Configurações + competência de salário — Sprint 14.
- Override de natureza por transação — decisão explícita desta sessão: não
  agora.
- CRUD completo de categoria/grupo (criar/renomear/excluir) — continua sem
  UI, fora do pedido desta sprint.

## Referências

- [docs/roadmap.md](../roadmap.md) (entrada da Sprint 12, épico E9 novo)
- [PRD-002 — Dados mestres (categorias/subcategorias/natureza, ativos/passivos)](PRD-002-dados-mestres-migracao-legado.md)
  (origem do campo `natureza`, decisão de não ter default herdado no import)
- [PRD-005 — Dashboards core](PRD-005-dashboards-core.md) (registrou "quebra
  por natureza" como fora de escopo, nunca entregue em E6)
- [PRD-009 — Dashboards Ativos/Passivos](PRD-009-dashboards-ativos-passivos.md)
  (padrão mais recente de agregação `por-X`/`por-X/tendencia` a espelhar)
- [PRD-011 — Categorização: tabela moderna](PRD-011-categorizacao-tabela-moderna.md)
  (componentes de edição inline/drill-down reaproveitados aqui)
