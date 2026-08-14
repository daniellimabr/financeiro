# PRD-005: Dashboards core (receita/despesa/saldo/patrimônio, drill-down)

- **Status:** aprovado
- **Épico relacionado:** E5 — Dashboards core ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-005](../sprints/SPRINT-005-dashboards-core-plan.md)

## Problema

Desde a Sprint 4, transações reais chegam categorizadas (regras + memória,
~99% de acerto validado pelo CEO), mas não existe nenhuma tela que some ou
agrupe esse dado — o usuário só vê uma listagem plana em `TransactionsPage`.
O roadmap já registrava que E5/E6 seriam detalhadas assim que houvesse dados
reais categorizados para validar contra elas; essa condição está satisfeita.
Falta a visão consolidada que dá sentido a categorizar: quanto entrou, quanto
saiu, qual o saldo do período e qual o patrimônio atual, com capacidade de
descer do total até a transação individual que o compõe.

## Escopo

- **Incluído:**
  - Cálculo de `data_competencia` em `pluggy_transactions` (campo existe
    desde a Sprint 3, nunca populado): igual a `data` em toda transação,
    calculado no momento do sync (`_upsert_transaction`). Backfill das
    linhas já sincronizadas via migration.
  - Nova coluna `category_groups.excluir_de_totais` (bool, default
    `false`), setada `true` para o grupo `Transferência interna` via
    migration — evita contar a mesma despesa duas vezes (compra no cartão +
    pagamento da fatura pela conta corrente) nos totais agregados. Não
    afeta a listagem de transações, só as agregações.
  - Módulo `app/dashboards/`: três endpoints de agregação —
    `GET /dashboards/summary` (receita, despesa, saldo, patrimônio),
    `GET /dashboards/por-categoria` (drill-down por categoria/subcategoria),
    `GET /dashboards/por-meio-pagamento` (drill-down por tipo de conta
    Pluggy) — todos filtráveis por ano/mês (exceto patrimônio, que é
    snapshot atual) e isolados por `user_id`.
  - Extensão de `GET /pluggy/transactions` com filtros opcionais (`ano`,
    `mes`, `subcategory_id`, `account_tipo`, `competencia`) para servir o
    último nível do drill-down (linha de extrato) sem duplicar endpoint.
  - Frontend: `DashboardsPage` com filtro ano/mês, cards de resumo
    (Receita, Despesa, Saldo, Patrimônio atual) e navegação em funil
    Receita/Despesa → Categoria → Meio de pagamento → Linha de extrato,
    usando gráficos (biblioteca nova: Recharts).
  - Geração de `DESIGN.md` via fluxo `new-work` do Impeccable durante a
    construção do frontend desta sprint (primeira com trabalho visual
    real), e `/impeccable audit` como gate antes de fechar a sprint —
    conforme já sinalizado em ADR-002-plugins.md.
  - Testes automatizados (meta ≥80% cobertura na lógica nova), sem
    depender de rede/credenciais reais.
- **Fora de escopo (explicitamente):**
  - Quebra de despesas por `natureza` (fixa/variável/eventual) e por
    ativo associado, evolução histórica de patrimônio/investimentos — E6.
  - Perfil de usuário, logout, multiusuário — E7.
  - UI/API para editar `category_groups.excluir_de_totais` manualmente —
    só setado via migration nesta sprint; se surgir necessidade de mais
    grupos excluídos, é ajuste de dado, não de mecanismo.
  - Override manual de `data_competencia` por transação — schema já
    suporta (coluna gravada, não computada on-the-fly), endpoint/UI fica
    para quando houver caso real.
  - Tabelas pré-calculadas ou cache de agregação — decisão fixa do
    projeto ("leitura direta/agregação simples").
  - Sync agendado/webhooks — backlog já registrado, fora de qualquer
    sprint até o CEO priorizar.

## Critérios de aceite

1. Dado o sync de uma transação (nova ou re-sync), então `data_competencia`
   é gravada igual a `data` — nunca fica `NULL` para transações
   sincronizadas a partir desta sprint.
2. Dada a migration desta sprint, então toda transação já sincronizada
   anteriormente com `data_competencia IS NULL` passa a ter
   `data_competencia = data`.
3. Dado um usuário autenticado com transações confirmadas em um período,
   quando chama `GET /dashboards/summary?ano=&mes=`, então recebe
   `receita`, `despesa` e `saldo` calculados sobre `data_competencia` no
   período, excluindo transações do grupo `Transferência interna`, e
   `patrimonio` calculado como snapshot atual (ativos ativos − passivos
   ativos + soma de saldos de contas Pluggy), independente do filtro de
   período.
4. Dado um período contendo apenas transações do grupo `Transferência
   interna`, então `receita`/`despesa`/`saldo` desse período são zero, mas
   essas transações continuam aparecendo normalmente em
   `GET /pluggy/transactions` para o mesmo período.
5. Dado um usuário autenticado, quando chama
   `GET /dashboards/por-categoria?ano=&mes=&tipo=debito|credito`, então
   recebe totais agrupados por grupo/subcategoria (mais um bucket "não
   categorizado" para `subcategory_id IS NULL`), cuja soma bate com o
   `despesa`/`receita` de `/summary` para os mesmos filtros.
6. Dado um usuário autenticado, quando chama
   `GET /dashboards/por-meio-pagamento?ano=&mes=&tipo=&categoria_id=`,
   então recebe totais agrupados por `pluggy_accounts.tipo`, opcionalmente
   restritos à categoria informada.
7. Dado `GET /pluggy/transactions` com os novos filtros opcionais
   combinados (`ano`, `mes`, `subcategory_id`, `account_tipo`,
   `competencia`), então retorna só as transações correspondentes; chamado
   sem nenhum filtro, o comportamento é idêntico ao existente antes desta
   sprint (sem regressão em `TransactionsPage`).
8. Dado dois usuários diferentes, quando cada um chama qualquer endpoint
   de `/dashboards/*` ou os novos filtros de `/pluggy/transactions`, então
   nunca vê total, categoria ou transação do outro usuário.
9. Dado qualquer requisição a `/dashboards/*` sem cookie de sessão válido,
   então recebo 401.
10. Dado o CI, quando a suíte roda, então os testes novos (backfill de
    competência, agregações, endpoints, filtros de transações) passam com
    cobertura ≥80% nos módulos novos.
11. Dado o frontend, quando o usuário abre a aba Dashboards, escolhe
    ano/mês, vê os quatro totais, clica em Despesa (ou Receita), vê o
    detalhamento por categoria, clica numa categoria, vê o detalhamento
    por meio de pagamento, clica num meio de pagamento e vê as transações
    correspondentes.

## Regras de negócio

- `data_competencia` é sempre igual a `data` nesta sprint — não existe
  entidade de fatura/parcela no schema que justifique divergência; ver
  discussão completa no plano de sprint. A coluna continua gravada (não
  computada em tempo de consulta) para permitir override manual futuro
  sem tocar `data`.
- Exclusão de dupla contagem é resolvida por categoria
  (`excluir_de_totais`), não por data — pagar a fatura do cartão pela
  conta corrente é uma transferência interna, não uma despesa nova; a
  despesa real já foi contada na compra original no cartão.
- `patrimonio` em `/dashboards/summary` ignora o filtro de ano/mês: não há
  série histórica de saldo de conta ou valor de ativo neste schema (isso é
  E6); o frontend rotula como "Patrimônio atual" para não sugerir que
  varia com o filtro de período.
- Sinal do saldo de conta `cartao_credito` na fórmula de patrimônio deve
  ser confirmado empiricamente contra dado real já sincronizado na VM de
  dev antes de fechar a implementação (não assumir a partir da
  documentação pública da Pluggy — já divergiu do observado antes, ver
  Sprint 3).
- Agregações são sempre recalculadas por consulta direta (SQLAlchemy
  `group_by`/`func.sum`), sem tabela pré-calculada nem cache — mesmo
  padrão de simplicidade já usado em categorização (Sprint 4).

## Dados e modelo

- `category_groups` (migration `0007`, altera tabela existente):
  `excluir_de_totais` (boolean, not null, default `false`); migration seta
  `true` para o grupo `Transferência interna` (dado já existente, do
  import do legado).
- `pluggy_transactions`: nenhuma coluna nova — `data_competencia` já
  existe desde a migration `0004`. Migration `0007` faz backfill
  (`UPDATE ... SET data_competencia = data WHERE data_competencia IS
  NULL`) e cria índice composto `ix_pluggy_transactions_user_id_data_competencia`
  em `(user_id, data_competencia)`, mesmo padrão do índice de
  `categorizacao_status` criado na `0006`.
- Nenhuma tabela nova — dashboards leem `pluggy_transactions`,
  `pluggy_accounts`, `assets`, `liabilities`, `category_groups`,
  `subcategories` diretamente.
- Migrations Alembic: `0007` (`excluir_de_totais` + backfill + índice),
  reversível (downgrade remove coluna e índice; os `UPDATE`s de dado não
  são revertidos, mesmo padrão da `0006`).

## Segurança

- Isolamento por usuário: todo endpoint de `/dashboards/*` e os novos
  filtros de `/pluggy/transactions` filtram por `user_id` do JWT, mesmo
  padrão de `assets`/`liabilities`/`pluggy_*`/`categorization`.
- Nenhum dado de transação bruto de um usuário chega a outro em nenhuma
  agregação.
- Nenhum secret novo introduzido nesta sprint.
- Nenhuma chamada a serviço externo nova (dashboards leem só o banco
  local).

## Fora de escopo / decisões adiadas

- Despesas por natureza/ativo, evolução de patrimônio e investimentos ao
  longo do tempo — E6.
- Perfil de usuário, logout, multiusuário — E7.
- UI de gestão de `category_groups.excluir_de_totais` — só migration
  nesta sprint.
- Override manual de `data_competencia` por transação — schema pronto,
  endpoint/UI adiados.
- Tabelas pré-calculadas/cache de agregação — decisão fixa do projeto.

## Referências

- [docs/roadmap.md](../roadmap.md) (E5)
- [PRODUCT.md](../../PRODUCT.md) (funil de drill-down Receita-Despesa →
  Categoria → Meio de pagamento → Linha de extrato)
- [PRD-002 — Dados mestres](PRD-002-dados-mestres-migracao-legado.md)
  (`assets.valor_atual`, `liabilities.saldo_devedor`)
- [PRD-003 — Integração Pluggy](PRD-003-integracao-pluggy.md)
  (`data_competencia` reservado desde a Sprint 3, `pluggy_accounts.saldo`)
- [PRD-004 — Categorização automática](PRD-004-categorizacao-automatica.md)
  (dado categorizado real que viabiliza os dashboards)
- [ADR-001 — Stack](../architecture/adr/ADR-001-stack.md)
- [ADR-002 — Plugins](../architecture/adr/ADR-002-plugins.md) (gatilho de
  `DESIGN.md`/Impeccable nesta sprint)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
