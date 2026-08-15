# PRD-010: Revisão de UX (Dashboard/Categorização) e Gestão de Passivos

- **Status:** aprovado
- **Épico relacionado:** cross-epic (E3 Categorização, E5 Dashboards core,
  E6 Dashboards analíticos, E4 Dados mestres) — ver [docs/roadmap.md](../roadmap.md)
- **Sprint(s):** [SPRINT-010](../sprints/SPRINT-010-revisao-ux-e-passivos-plan.md)

## Problema

Usando o app na prática pós-Sprint 9, o CEO levantou 8 problemas reais,
nenhum deles coberto por PRD anterior:

1. Transações de "NuTag" aparecem contando como receita no Dashboard —
   suspeita de erro de classificação.
2. A aba "Início" é redundante com "Dashboards" (2 botões de menu para
   praticamente a mesma coisa).
3. O tooltip dos gráficos do Dashboard mostra "v:" (nome de série interno,
   sem sentido pro usuário) em vez do mês/ano do ponto, com fonte grande
   demais.
4. O card "Patrimônio" mostra só um número final, sem abrir a composição
   do cálculo.
5. O drill-down do Dashboard (linha de extrato) é só leitura — para
   corrigir descrição/categoria/ativo de uma transação, o usuário precisa
   sair do Dashboard e ir na tela de Categorização.
6. Não existe tela de gestão de passivos (o CRUD já existe no backend
   desde a Sprint 2, mas nunca ganhou UI — hoje só dá pra ver passivos
   dentro do drill-down do Dashboard, sem criar/editar/quitar).
7. A tela de Categorização não permite filtrar por "já associado a ativo"
   nem por categoria (grupo), e a sugestão automática de ativo é uma
   heurística muito mais simples (substring) que a de categoria (regras +
   histórico + similaridade) — o próprio plano da Sprint 4 já registrou
   essa lacuna como risco não validado.
8. No menu lateral, "Gestão de Contas" está no meio da lista, sem lógica
   de agrupamento com os outros itens.

Investigação de código (não envolve nenhum dado do usuário) confirmou um
ponto importante para o item 1: **não existe hoje nenhum campo em
"categoria" que controle receita/despesa.** Quem decide isso é só
`PluggyTransaction.tipo` (`debito`/`credito`,
`backend/app/models/pluggy.py`), setado uma única vez no sync a partir do
campo bruto `raw["type"]` da Pluggy (`_map_transaction_tipo`,
`backend/app/pluggy_integration/service.py:290-291` — mapeamento direto
`DEBIT`→débito, qualquer outra coisa→crédito, sem lógica adicional) e sem
nenhum endpoint que permita editá-lo depois. `Subcategory.natureza`
(`backend/app/models/category.py:15-18`, valores `fixa`/`variavel`/
`eventual`) é uma classificação de regularidade orçamentária, não direção
de fluxo de caixa — não tem relação com receita/despesa. Ou seja, a
hipótese do CEO ("pode ter sido eu que classifiquei como custo, fico
confuso...") não bate com nenhum mecanismo que existe hoje no sistema; o
problema mais provável está no dado bruto vindo da Pluggy para essa conta/
transação específica, e só investigação com dado real confirma a causa.

## Escopo

- **Incluído:**
  - **NuTag (investigação + correção pontual):** consulta via SSH
    (`docs/infra/ssh-workflow.md`, VM de dev) das transações reais do
    usuário com descrição contendo "NuTag" — conferir `tipo` e, se
    disponível, indícios do payload/heurística de mapeamento de conta
    (`_map_account_tipo`, `backend/app/pluggy_integration/service.py:278-287`).
    Com a causa confirmada, aplicar correção pontual (fix de mapeamento se
    for um padrão sistemático de tipo de conta, ou correção direta dos
    registros já sincronizados se for caso isolado) — sem criar
    endpoint/UI de override manual de débito/crédito (decisão explícita
    desta sessão, ver "Fora de escopo").
  - **Indicador visual débito/crédito na tela de Categorização:**
    reaproveitar o padrão de ícone por meio de pagamento já usado no
    Dashboard (`AccountTipoIcon`, Sprint 9) para deixar claro, linha a
    linha, se a transação é entrada ou saída — reduz a chance da mesma
    confusão se repetir.
  - **Fusão Início → Dashboard:** remover a aba "Início" (hoje um stub
    estático sem dado próprio, `frontend/src/pages/ProtectedPage.tsx:52-60`),
    tornar "Dashboards" a aba inicial.
  - **Tooltip do gráfico:** `CardSparkline`
    (`frontend/src/components/CardSparkline.tsx`) passa a receber os
    pontos com mês/ano (não só valores soltos), mostrando "MM/AAAA" no
    lugar do rótulo "v:" e com fonte consistente com `TrendChart`
    (`itemStyle`/`labelStyle` explícitos, não só `contentStyle`).
  - **Drill-down do card Patrimônio:** novo endpoint
    `GET /dashboards/patrimonio/breakdown` expondo as 4 partes que
    `_calcula_patrimonio` (`backend/app/dashboards/service.py:182-203`) já
    soma internamente (ativos, passivos, saldo de contas não-cartão, saldo
    de cartões) e nova UI de tabela no card, linkando para os drill-downs
    já existentes (Ativos/Passivos/Saldo) em vez de duplicá-los.
  - **Edição inline no drill-down do Dashboard:** os controles de edição
    de descrição/categoria/ativo já existentes na tela de Categorização
    (`frontend/src/pages/CategorizationReviewPage.tsx`, chamando
    `PUT /categorization/transactions/{id}/description|category|asset`)
    passam a estar disponíveis também nas tabelas de transação do
    drill-down do Dashboard (`TransacoesPanel`) e do drill-down de Ativos
    (`AssetDrilldown`), via componente(s) de edição compartilhado(s).
  - **Gestão de Passivos (tela nova):** CRUD completo + quitação pela UI,
    espelhando 1:1 a tela de Gestão de Ativos (`AssetsPage`) — o backend
    (`Liability`, `backend/app/liabilities/`) já existe completo e
    testado, não precisa de mudança.
  - **Categorização — filtro "associado a ativo":** novo parâmetro
    `has_asset: bool | None` em `GET /categorization/transactions`.
  - **Categorização — filtro por categoria (grupo):** novo parâmetro
    `group_id: int | None` no mesmo endpoint, permitindo restringir a
    lista a um grupo e revisar a associação de ativo item a item.
  - **Memória e sugestão de ativo (motor de 3 camadas):** elevar
    `suggest_asset_from_index` (hoje só "contains" normalizado,
    `backend/app/categorization/engine.py:144-154`) ao mesmo padrão do
    motor de categoria — regra exata → histórico confirmado exato →
    similaridade `difflib >= 0.86` — via nova tabela
    `asset_categorization_rules` espelhando `categorization_rules`
    (`backend/app/models/categorization.py`).
  - **Reordenar menu:** mover "Gestão de Contas" para o final da lista de
    navegação (`NAV_ITEMS`, `frontend/src/pages/ProtectedPage.tsx:15-21`).
  - Testes automatizados (meta ≥80% de cobertura nos módulos tocados).
- **Fora de escopo (explicitamente):**
  - Endpoint/UI de override manual de débito/crédito por transação — a
    correção do NuTag é pontual (dado), não uma feature nova. Fica como
    candidato de sprint futura caso a investigação revele que isso é
    necessário com frequência.
  - Aceitar valor de quitação em `POST /liabilities/{id}/settle` (paridade
    com `sell` de ativo) — o endpoint já existe sem esse campo; mudar o
    contrato fica fora desta sprint, a menos que a tela nova revele que é
    indispensável.
  - Motor de sugestão de 3 camadas para passivo
    (`suggest_liability_from_index`) — mesma limitação de hoje
    (heurística substring) permanece; só ativo é elevado nesta sprint, sem
    pedido do CEO para estender a passivo.
  - Extração de um componente de tooltip totalmente unificado entre
    `CardSparkline` e `TrendChart` — desejável, mas fica a critério da
    execução (não é critério de aceite).
  - Série histórica de saldo/patrimônio — mesma limitação registrada desde
    PRD-005/006, sem mudança nesta sprint.

## Critérios de aceite

1. Dado o payload real das transações "NuTag" do usuário na VM de dev,
   quando a investigação é concluída, então a causa raiz (mapeamento de
   sync ou dado isolado) fica documentada no relatório da sprint, e as
   transações históricas afetadas passam a ter `tipo` correto (despesa).
2. Dada a tela de Categorização, quando o usuário olha a lista, então cada
   linha mostra um indicador visual claro de débito/crédito.
3. Dado o menu lateral, quando o usuário loga, então não existe mais aba
   "Início" separada — "Dashboards" é a tela inicial.
4. Dado qualquer gráfico de tendência/sparkline no Dashboard, quando o
   usuário passa o mouse sobre um ponto, então o tooltip mostra o mês/ano
   de referência (não "v:") com fonte do mesmo tamanho usado em
   `TrendChart`.
5. Dado o card "Patrimônio", quando o usuário clica, então abre uma tabela
   com as 4 partes do cálculo (ativos, passivos, saldo de contas, saldo de
   cartões) somando exatamente o valor mostrado no card.
6. Dada uma transação no drill-down do Dashboard (funil de
   Receita/Despesa ou de Ativo), quando o usuário edita descrição,
   categoria ou ativo, então a mudança é salva pelo mesmo endpoint já
   usado em Categorização, e a tela reflete a mudança sem precisar de
   reload manual (F5).
7. Dado um usuário autenticado, quando acessa a nova tela "Passivos",
   então consegue criar, editar, excluir e quitar um passivo, e ver o
   drill-down de transações associadas — mesma paridade funcional de
   "Ativos" (exceto quitação sem valor, que segue o contrato atual do
   backend).
8. Dado `GET /categorization/transactions?has_asset=true`, então retorna
   só transações com `asset_id` preenchido; `has_asset=false`, só as sem
   `asset_id`; parâmetro omitido, comportamento atual (sem filtro).
9. Dado `GET /categorization/transactions?group_id=X`, então retorna só
   transações cuja subcategoria pertence ao grupo `X`.
10. Dado o motor de sugestão de ativo, quando uma transação pendente tem
    descrição normalizada batendo exatamente com uma regra de
    `asset_categorization_rules` ou com o histórico confirmado (exato ou
    similaridade `>= 0.86`), então `asset_sugerido_id`/
    `asset_sugestao_confianca` são preenchidos com a mesma
    confiança/proveniência do motor de categoria.
11. Dado o menu lateral, então "Gestão de Contas" é o último item da
    lista, nessa ordem: Dashboards, Categorizar, Ativos, Passivos, Gestão
    de Contas.
12. Dado dois usuários diferentes, quando cada um usa qualquer endpoint
    novo ou alterado desta sprint, então nunca vê dado do outro usuário.
13. Dado qualquer requisição às rotas novas sem cookie de sessão válido,
    então recebo 401.
14. Dado o CI, quando a suíte roda, então os testes novos (backend +
    frontend) passam com cobertura ≥80% nos módulos tocados.

## Regras de negócio

- `PluggyTransaction.tipo` continua sendo a única fonte de verdade para
  receita/despesa em toda agregação — esta sprint não introduz um segundo
  mecanismo concorrente (ex.: não usar `Natureza`/`excluir_de_totais` para
  isso).
- O breakdown de patrimônio (`GET /dashboards/patrimonio/breakdown`)
  reaproveita exatamente as mesmas 4 somas de `_calcula_patrimonio`
  (`_ativos_e_passivos` + saldo de contas não-cartão + saldo de cartões) —
  nunca pode divergir do valor de `patrimonio` já retornado por
  `GET /dashboards/summary`.
- `has_asset`/`group_id` em `GET /categorization/transactions` são
  filtros independentes e combináveis com `status`/`tipo`/`ano`/`mes`
  já existentes (todos aplicados com `AND`).
- `asset_categorization_rules` segue o mesmo modelo de precedência de
  `categorization_rules`: regra exata > histórico confirmado exato >
  similaridade (`difflib >= 0.86`, mesmo `SIMILARITY_THRESHOLD` já
  definido em `engine.py`) — nunca combina fontes, usa a primeira que
  bater nessa ordem.
- Excluir um passivo pela nova tela usa o mesmo contrato já existente
  (`DELETE /liabilities/{id}` desassocia `liability_id`/
  `liability_sugerido_id`, nunca apaga transação) — sem mudança de
  comportamento, só nova UI.
- Mutations de edição de transação (descrição/categoria/ativo) devem
  invalidar tanto a query de Categorização quanto as usadas pelo
  Dashboard (`pluggyTransactions`, agregações), para que uma edição feita
  a partir do drill-down do Dashboard atualize a própria tela sem reload.

## Dados e modelo

- Nova tabela `asset_categorization_rules` (migration reversível nova),
  espelhando `categorization_rules`
  (`backend/app/models/categorization.py:9-26`) trocando
  `subcategory_id` por `asset_id` (FK `assets.id`), mesmo `UniqueConstraint`
  por usuário+padrão normalizado.
- Nenhuma mudança de schema em `PluggyTransaction`, `Asset` ou `Liability`
  — todos os campos necessários (`asset_id`, `asset_sugerido_id`,
  `asset_sugestao_confianca`, `liability_id`, `tipo`) já existem desde
  Sprint 4/9.
- Nenhuma tabela nova para Passivos — `Liability`
  (`backend/app/models/liability.py`) já existe desde a Sprint 2.
- Correção pontual do NuTag (item 1): sem migration — é `UPDATE` direto
  nas linhas afetadas de `pluggy_transactions` (ou fix de código em
  `_map_transaction_tipo`/`_map_account_tipo` se a causa for sistemática),
  aplicado como parte da execução da sprint, documentado no relatório com
  os IDs/critério usado.

## Segurança

- Isolamento por usuário: `GET /dashboards/patrimonio/breakdown`,
  `has_asset`/`group_id` em `GET /categorization/transactions`, e todo
  endpoint novo de `Liability` consumido pela tela nova seguem o mesmo
  padrão `Depends(get_current_user)` + filtro `user_id` já usado em todo
  o projeto.
- Nenhum secret novo. Nenhuma chamada a serviço externo nova — a
  investigação do NuTag usa dado já sincronizado (não faz nova chamada à
  API da Pluggy).
- Acesso à VM de dev para a investigação do NuTag segue
  `docs/infra/ssh-workflow.md` (paramiko, Claude executa livremente em
  dev).

## Fora de escopo / decisões adiadas

- Override manual de débito/crédito por transação — decisão explícita do
  CEO nesta sessão de planejamento; reavaliar só se a investigação do
  NuTag mostrar um padrão recorrente (não um caso isolado).
- Paridade de payload entre `sell` (ativo) e `settle` (passivo) — mantido
  como está.
- Motor de sugestão de 3 camadas para passivo — só ativo nesta sprint.
- Série histórica de saldo/patrimônio — mesma limitação de PRD-005/006.

## Referências

- [docs/roadmap.md](../roadmap.md)
- [PRD-004 — Categorização automática](PRD-004-categorizacao-automatica.md)
  (motor de sugestão de categoria, heurística original de ativo)
- [PRD-005 — Dashboards core](PRD-005-dashboards-core.md) (`_calcula_patrimonio`)
- [PRD-008 — Gestão de Ativos](PRD-008-gestao-de-ativos.md) (padrão que a
  tela de Passivos espelha)
- [PRD-009 — Dashboards analíticos: Ativos/Passivos](PRD-009-dashboards-ativos-passivos.md)
  (`AccountTipoIcon`, `CardSparkline`/`TrendChart`, `_ativos_e_passivos`,
  cards Ativos/Passivos, funil Categoria>Tipo>Transação)
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
