# PRD-003: Integração Pluggy (contas e transações bancárias)

- **Status:** aprovado
- **Épico relacionado:** E2 — Integração Pluggy ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-003](../sprints/SPRINT-003-integracao-pluggy-plan.md)

## Problema

Hoje o sistema não tem nenhum dado transacional real — só dados mestres
(categorias, ativos/passivos). Não é possível montar nenhum dashboard (E5/E6)
sem extratos bancários, faturas de cartão e movimentações de investimento
fluindo para o banco. O usuário precisa poder conectar suas contas via Pluggy e
disparar uma sincronização manual que traga esses dados.

O roadmap original previa Pluggy (E2) e o motor de categorização (E3) na mesma
Sprint 3. Na sessão de planejamento desta sprint, decidiu-se dividir: **esta
sprint entrega só E2**. Transações chegam sem categoria — E3 (Sprint 4) cuida
de categorizá-las, quando já houver dado real para calibrar o motor de regras.

## Escopo

- **Incluído:**
  - Conexão de conta bancária via widget Pluggy Connect (fluxo completo:
    connect token → widget → callback → registro do item no backend).
  - Schema de conexões (`pluggy_items`), contas (`pluggy_accounts`) e
    transações (`pluggy_transactions`), isolado por usuário.
  - Sincronização manual (botão) por item conectado: busca contas e
    transações via API Pluggy, faz upsert idempotente, respeita uma data de
    corte de histórico por item.
  - Cliente HTTP para a API Pluggy (`app/pluggy_integration/client.py`),
    autenticação via API key, testável sem dependência de rede real.
  - UI mínima: tela de conectar conta e tela de listagem de transações
    sincronizadas (somente leitura), com botão de sincronizar.
  - Testes automatizados (unitários + integração), cobertura ≥80% da lógica
    de negócio nova, sem depender de credenciais/rede real no CI.
  - Script de validação manual contra o sandbox Pluggy (não roda em CI).
- **Fora de escopo (explicitamente):**
  - Motor de categorização por regras + memória, fila de revisão manual,
    associação despesa↔ativo — tudo isso é E3, planejado para a Sprint 4.
  - Cálculo automático de data de competência de receita — o campo existe no
    schema (nullable), mas não é preenchido pelo sync nesta sprint.
  - Seletor de contas próprio — usa a seleção nativa do widget Pluggy Connect.
  - Sync agendado/automático e webhooks — decisão fixa do projeto é sync
    sempre manual, sem fila de background.
  - UI dedicada de reconexão (distinta de "conectar nova conta") — reaproveita
    o mesmo fluxo passando o `item_id` existente.
  - Modelagem de fatura de cartão de crédito (fechamento/vencimento) — cartão
    é tratado como mais um tipo de conta com transações nesta sprint.

## Critérios de aceite

1. Dado um usuário autenticado, quando chama `POST /pluggy/connect-token`,
   então recebe um token válido gerado a partir das credenciais configuradas
   (mockado em teste automatizado; validado de verdade contra o sandbox na VM
   de dev).
2. Dado o retorno do widget Pluggy Connect (`item.id`), quando o frontend
   chama `POST /pluggy/items`, então uma `PluggyItem` é criada vinculada ao
   usuário autenticado, e reenviar o mesmo `pluggy_item_id` não cria
   duplicata.
3. Dado um item com status `updated` na Pluggy, quando chamo
   `POST /pluggy/items/{id}/sync`, então contas e transações são
   criadas/atualizadas no banco, transações anteriores ao `cutoff_date` do
   item não são trazidas, e uma segunda chamada não duplica transações já
   existentes (upsert por `pluggy_transaction_id`).
4. Dado um item com status `updating` ou `login_error` na Pluggy, quando
   chamo o sync, então recebo um erro claro (400), e nenhum dado é gravado.
5. Dado dois usuários diferentes, quando o usuário A lista seus
   items/contas/transações, então não vê nada do usuário B.
6. Dado qualquer transação sincronizada, então `subcategory_id` e
   `data_competencia` estão `NULL`.
7. Dado o frontend, quando o usuário clica em "Conectar conta bancária", o
   widget Pluggy Connect abre, e após conexão bem-sucedida no sandbox, a
   conta aparece na lista de items e as transações aparecem na tela de
   listagem após clicar em "Sincronizar".
8. Dado qualquer requisição a `/pluggy/*` sem cookie de sessão válido, então
   recebo 401.
9. Dado o CI, quando a suíte roda, então os testes novos (cliente mockado,
   service, endpoints) passam com cobertura ≥80% nos módulos novos, sem
   depender de rede/credenciais reais.
10. Dado o Caddyfile atualizado e o Caddy reiniciado na VM de dev, quando
    acesso `/pluggy/*` pelo domínio público, então a requisição chega na API
    (não cai no frontend/SPA).

## Regras de negócio

- Isolamento por usuário em toda a cadeia: item pertence a um usuário, conta
  pertence a um item (com `user_id` denormalizado, mesmo padrão de
  `assets`/`liabilities`), transação pertence a uma conta (idem).
- Upsert idempotente por id externo da Pluggy em todas as entidades
  (`pluggy_item_id`, `pluggy_account_id`, `pluggy_transaction_id`) — via
  query-then-insert/update pelo ORM, não `INSERT ... ON CONFLICT` (consistência
  de estilo com o resto do código-base; volume baixo torna o trade-off
  aceitável).
- `cutoff_date` é por item (não só global), com default =
  `settings.pluggy_sync_cutoff_date` (`2026-01-01`, alinhado à decisão fixa do
  CLAUDE.md sobre corte de dados) na criação do item.
- Sync nunca sobrescreve/derruba dado local que não veio da Pluggy nesta
  sprint (não há dado local concorrente ainda — só relevante a partir de E3).
- Item em status `updating`/`login_error`/`error`/`waiting_user_input` não
  pode ser sincronizado — service levanta `InvalidStateError` (→ 400),
  seguindo o mapeamento já usado em `assets/router.py`.
- `categoria_pluggy` é armazenada só como referência informativa da própria
  Pluggy — nunca é a fonte de verdade da categorização (que será regras +
  memória, sem LLM, definida em E3).
- Autenticação com a API Pluggy é via API key (obtida com `clientId`/
  `clientSecret`), cacheada em memória do processo, sem persistir em banco.

## Dados e modelo

Migration `backend/alembic/versions/0004_create_pluggy_tables.py`, três
tabelas novas em `backend/app/models/pluggy.py`:

- **`pluggy_items`**: `id`, `user_id` (FK), `pluggy_item_id` (unique),
  `connector_id`, `connector_name`, `status` (enum), `status_detail`,
  `cutoff_date`, `last_synced_at`, timestamps.
- **`pluggy_accounts`**: `id`, `item_id` (FK), `user_id` (FK, denormalizado),
  `pluggy_account_id` (unique), `tipo` (enum: corrente/poupança/cartão de
  crédito/investimento), `nome`, `numero_mascarado`, `saldo`, `moeda`,
  timestamps.
- **`pluggy_transactions`**: `id`, `account_id` (FK), `user_id` (FK,
  denormalizado), `pluggy_transaction_id` (unique, chave de idempotência),
  `descricao`, `valor`, `tipo` (débito/crédito), `data`, `data_competencia`
  (nullable, não preenchido nesta sprint), `subcategory_id` (FK nullable, não
  populado — E3 preenche), `categoria_pluggy` (referência informativa),
  `status` (pendente/efetivada), timestamps.

Índices: unique nos três ids externos da Pluggy; índice em `user_id` nas três
tabelas (padrão de isolamento); índice composto `(account_id, data)` para
listagem ordenada.

## Segurança

- Isolamento de dados por usuário: `user_id` presente e filtrado em toda
  query das três tabelas, seguindo a dependency `get_current_user` já
  existente da Sprint 1 — mesmo padrão de `assets`/`liabilities`.
- Secrets/credenciais: `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` via variável
  de ambiente (`.env`, nunca commitado), com placeholders vazios em
  `.env.example`. Credenciais reais (sandbox) fornecidas pelo CEO e
  configuradas manualmente no `.env` da VM de dev antes da validação ponta a
  ponta — nunca via commit ou script automatizado.
- Nenhum dado sensível de transação é compartilhado entre usuários nesta
  sprint (não há memória compartilhada ainda — só entra em E3).

## Fora de escopo / decisões adiadas

- Categorização automática, regras, memória, fila de revisão manual,
  associação despesa↔ativo — Sprint 4 (E3), quando já houver transações reais
  sincronizadas para calibrar o motor.
- Data de competência de receita (cálculo automático) — campo existe, lógica
  fica para E3/E5.
- Webhooks/sync agendado — fora do roadmap a menos que o CEO priorize
  explicitamente (já registrado como backlog futuro em `docs/roadmap.md`).
- Modelagem detalhada de fatura de cartão de crédito — revisar se E6
  (dashboards de patrimônio/evolução) exigir.
- UI de reconexão dedicada — reaproveita o fluxo de conexão existente; revisar
  se a validação manual mostrar confusão de UX real.

## Referências

- [ADR-001-stack.md](../architecture/adr/ADR-001-stack.md) — stack aprovada,
  decisão de sync manual/síncrono sem fila de background.
- [docs/roadmap.md](../roadmap.md) — épico E2 e sequência de sprints.
- [docs/migration/legacy-data.md](../migration/legacy-data.md) §3 — notas do
  motor de sugestão do v1, referência para o design de E3 (não usado nesta
  sprint, mas relevante para não modelar transação de um jeito que atrapalhe
  E3 depois — daí `categoria_pluggy` e `subcategory_id` já existirem no
  schema desde já).
- [PRD-002-dados-mestres-migracao-legado.md](PRD-002-dados-mestres-migracao-legado.md)
  — `assets`/`liabilities`/`subcategories`, padrão de isolamento por usuário
  reaproveitado aqui.
