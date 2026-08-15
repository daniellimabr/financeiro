# PRD-007: Categorização (rework), eliminação de Transações e Gestão de Contas

- **Status:** aprovado
- **Épico relacionado:** E3 — Categorização, E2 — Integração Pluggy ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-007](../sprints/SPRINT-007-categorizacao-gestao-contas-plan.md)

## Problema

O CEO trouxe um pedido de ajustes de tela mais amplo do que a Sprint 7
estava reservada para cobrir no roadmap ("ajustes pontuais, escopo a
definir"). Levantamento contra o código mostrou 3 fatias de épico
distintas — Categorização (rework de UX + eliminação da tela Transações +
gestão de contas conectadas), Gestão de Ativos (E6 parte 2) e Dashboard
analítico (E6, cards/drilldowns novos). Dividido com o CEO em 3 sprints por
área natural; este PRD cobre só a primeira fatia.

Hoje a fila de Categorização (`CategorizationReviewPage.tsx`,
`GET /categorization/pending`) só lista pendentes, sem filtro de tipo
(receita/despesa) ou status (confirmada/pendente), sem seleção em lote, sem
forma de corrigir a categoria de uma transação já confirmada, e sem
descrição editável. A tela de Transações (`TransactionsPage.tsx`) é fina
demais para justificar existir separada — só lista transações sincronizadas
sem nenhuma ação de categorização — e duplica esforço de manutenção. A tela
"Conectar Conta" só conecta e lista itens por nome/status, sem permitir
renomear ou desativar uma conta do sync.

## Escopo

- **Incluído:**
  - Fila de Categorização ganha filtro por tipo (receita/despesa, mapeado
    de `tipo` débito/crédito já existente no schema) e por status
    (pendentes/confirmadas/todas).
  - Seleção em lote (checkbox por linha + "marcar todas") e aprovação em
    lote das linhas marcadas.
  - Botão "Editar categoria" em linhas já confirmadas — corrige a
    categorização depois de aprovada, inclusive a associação de ativo.
  - Descrição da linha de extrato editável — clique no texto abre edição
    inline. A edição se propaga como **sugestão pendente de aprovação**
    para outras transações do mesmo usuário com descrição normalizada
    idêntica e mesma categoria (confirmada ou sugerida); cada sugestão é
    aceita/descartada individualmente, nunca aplicada automaticamente.
  - Botão único de sincronização ("Sincronizar MeuPluggy") que abre a
    lista de contas conectadas com pré-seleção vinda do estado
    persistido de cada conta, aguardando confirmação do usuário antes de
    rodar.
  - Eliminação da tela Transações — suas funções (listar transações
    sincronizadas) são absorvidas pela fila de Categorização com o filtro
    de status "todas".
  - Renomeação de "Conectar Conta" para "Gestão de Contas": lista todas as
    contas conectadas (não só itens), com botão de editar por conta
    (apelido + remover da lista de sincronização).
  - Formato de moeda padronizado (`R$ 1.234,56`) extraído para util
    compartilhado e aplicado em todas as telas que exibem valores.
  - Nova subcategoria "Aluguel" sob o grupo de receita existente.
  - Testes automatizados (meta ≥80% cobertura nos módulos tocados, mirando
    100% nas funções novas).
- **Fora de escopo (explicitamente, viram Sprint 8/9):**
  - Tela de Gestão de Ativos (cards, criar/editar ativo, drilldown de
    custos por ativo) — Sprint 8, E6 parte 2. Backend CRUD já existe em
    `app/assets/`/`app/liabilities/` desde a Sprint 2, não é tocado aqui.
  - Cards Ativos/Passivos no Dashboard, drilldown de saldo por conta,
    tooltip em gráficos, remoção do gráfico de categorias, remoção do
    nível "meio de pagamento" do funil, ordenação por coluna nos
    drilldowns — Sprint 9, E6 parte 3.
  - Modernização visual/paginação da tabela de Categorização (ficava
    reservada como "Sprint 8" no roadmap anterior a esta sessão) —
    renumerada para depois da Sprint 9; a ordenação por coluna deste PRD
    fica restrita ao Dashboard (Sprint 9), não a esta tela.
  - Estado "pular/ignorar" na fila de revisão — segue fora de escopo desde
    o PRD-004.
  - Reconciliação de descrição quando a Pluggy reenvia uma transação já
    editada pelo usuário: `descricao_usuario`, uma vez setado, nunca é
    sobrescrito por sync — não há merge/conflito a resolver nesta sprint.

## Critérios de aceite

1. Dado um usuário com transações pendentes e confirmadas, quando chama
   `GET /categorization/transactions?status=confirmada`, então recebe só
   as confirmadas; com `status=pendente`, só as pendentes; com
   `status=todas` (ou omitido), recebe ambas.
2. Dado o mesmo endpoint com `tipo=credito` ou `tipo=debito`, então a
   listagem retorna só transações do tipo pedido (receita/despesa).
3. Dado um conjunto de transações pendentes com categoria já selecionada
   no cliente, quando chamo `POST /categorization/transactions/bulk-confirm`
   com a lista de `{transaction_id, subcategory_id}`, então todas são
   confirmadas numa única chamada; se uma linha for inválida (categoria
   inexistente, transação de outro usuário), as demais ainda são
   confirmadas e a resposta reporta sucesso/falha por id.
4. Dado uma transação já `confirmada`, quando chamo
   `PUT /categorization/transactions/{id}/category` com um
   `subcategory_id` diferente, então a categoria é atualizada (a trava de
   "só pendente confirma" deixa de existir).
5. Dado uma transação com descrição "PADARIA DO ZE 1234", quando chamo
   `PUT /categorization/transactions/{id}/description` com uma nova
   descrição, então essa transação recebe `descricao_usuario` de
   imediato, e toda outra transação do mesmo usuário cuja descrição
   normalizada seja idêntica à original ("padaria do ze") **e** que
   compartilhe a mesma categoria (confirmada ou sugerida) recebe
   `descricao_sugerida` + `descricao_sugestao_origem_id` apontando pra
   transação editada — sem alterar a descrição exibida delas até
   aprovação individual.
6. Dado uma transação com `descricao_sugerida` pendente, quando chamo
   `POST /categorization/transactions/{id}/description/confirm`, então
   `descricao_usuario` passa a valer a sugestão e os campos de sugestão
   são limpos; `POST .../description/dismiss` limpa a sugestão sem
   aplicar.
7. Dado um usuário com contas conectadas, quando chama
   `PUT /pluggy/accounts/{id}` com `apelido`, então o apelido é salvo e
   passa a ser o nome exibido; um novo sync dessa conta não sobrescreve o
   apelido (só `nome`, campo bruto da Pluggy).
8. Dado uma conta com `sync_enabled=false`, quando rodo
   `POST /pluggy/sync` (com ou sem essa conta no filtro de itens), então
   essa conta não tem transações/saldo atualizados.
9. Dado dois usuários diferentes, nenhuma ação de listagem, confirmação em
   lote, edição de categoria, edição de descrição ou edição de conta de
   um usuário afeta ou expõe dado do outro.
10. Dado o frontend, a aba "Transações" não existe mais na navegação, e a
    fila de Categorização com filtro `status=todas` mostra o mesmo
    conjunto de transações que a tela antiga mostrava.
11. Dado o CI, a suíte de testes novos/alterados passa com cobertura
    ≥80% nos módulos tocados.

## Regras de negócio

- Propagação de descrição usa **match exato de descrição normalizada**
  (reaproveitando `normalize.py` do motor de categorização), não a
  similaridade `>= 0.86` usada para sugestão de categoria — o pedido do
  CEO foi por itens "idênticos", e usar fuzzy aqui arriscaria renomear
  transações não relacionadas.
- Candidatas à propagação de descrição precisam também compartilhar a
  categoria (confirmada ou sugerida) da transação de origem — descrição
  igual sozinha não basta, conforme pedido explícito do CEO ("levando em
  consideração também a categoria").
- `descricao_usuario`, uma vez setado, nunca é sobrescrito por
  `_upsert_transaction` num sync futuro — só `descricao` (campo bruto)
  continua sendo atualizado pela Pluggy.
- `apelido` em `pluggy_accounts` segue a mesma regra: nunca sobrescrito
  por `_upsert_account`.
- `sync_enabled=false` numa conta faz `sync_item`/`sync_items` pular essa
  conta inteiramente (nem transações nem saldo são buscados) — é o
  mecanismo de "remover da lista de sync" pedido pelo CEO, e também a
  fonte da pré-seleção no diálogo de "Sincronizar MeuPluggy".
- Rotas antigas `/categorization/pending/*` são renomeadas para
  `/categorization/transactions/*` sem shim de compatibilidade — projeto
  sem consumidores externos além do próprio frontend, que é atualizado na
  mesma sprint.

## Dados e modelo

- Migration `0008` (reversível), altera 2 tabelas existentes:
  - `pluggy_accounts`: `apelido` (String, nullable), `sync_enabled`
    (Boolean, `server_default 'true'`).
  - `pluggy_transactions`: `descricao_usuario` (String(500), nullable),
    `descricao_sugerida` (String(500), nullable),
    `descricao_sugestao_origem_id` (FK `pluggy_transactions.id`,
    nullable).
  - Seed idempotente (`INSERT ... ON CONFLICT DO NOTHING`, mesmo padrão
    do import de categorias legado): subcategoria "Aluguel" sob o grupo
    de receita existente (confirmar nome exato do grupo já importado
    antes de decidir se reaproveita ou cria).
- Nenhuma tabela nova.

## Segurança

- Isolamento por usuário mantido em todos os endpoints novos/alterados —
  mesmo padrão de `assets`/`liabilities`/`pluggy_*`/`categorization_*`:
  toda query filtra por `user_id` do JWT.
- Bulk-confirm valida `subcategory_id` e propriedade da transação por
  item da lista — uma linha maliciosa/inválida não derruba as demais nem
  vaza dado de outro usuário.
- Propagação de descrição só considera transações do mesmo `user_id` —
  nunca cruza usuários (mesma regra de `categorization_rules` desde o
  PRD-004).
- Nenhum secret novo, nenhuma chamada a serviço externo além da Pluggy já
  integrada.

## Fora de escopo / decisões adiadas

- Tela de Gestão de Ativos — Sprint 8.
- Cards Ativos/Passivos, drilldown de saldo por conta (restrito ao mês
  corrente — sem histórico no schema), tooltip em gráficos, remoção do
  gráfico de categorias, remoção do nível "meio de pagamento" do funil
  (decisão que reverte um design já tratado como fechado em PRD-005/006 —
  a reversão em si é decisão do CEO nesta sessão, a implementar na Sprint
  9), ordenação por coluna nos drilldowns — Sprint 9.
- **Gap novo descoberto nesta sessão de planejamento:** não existe
  associação despesa↔passivo (`liability_id`) em `pluggy_transactions` —
  só despesa↔ativo (`asset_id`, desde a Sprint 4). O drilldown "despesas
  por passivo" pedido pelo CEO para o Dashboard (Sprint 9) precisa dessa
  associação nova, espelhando o padrão de `asset_id`; registrado no
  roadmap para não ser descoberto só na execução da Sprint 9.
- Modernização visual/paginação da tabela de Categorização — renumerada
  para depois da Sprint 9.
- Estado "pular/ignorar" na fila — segue fora de escopo desde o PRD-004.

## Referências

- [docs/roadmap.md](../roadmap.md) (E3, E2)
- [PRD-003 — Integração Pluggy](PRD-003-integracao-pluggy.md) (schema de
  `pluggy_items`/`pluggy_accounts`, decisão fixa de sync manual sem
  agendamento/webhook)
- [PRD-004 — Categorização automática](PRD-004-categorizacao-automatica.md)
  (motor de sugestão, `normalize.py`, fila de revisão original)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
