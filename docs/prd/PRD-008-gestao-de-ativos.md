# PRD-008: Gestão de Ativos

- **Status:** aprovado
- **Épico relacionado:** E6 — Dashboards analíticos, parte 2 ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-008](../sprints/SPRINT-008-gestao-de-ativos-plan.md)

## Problema

O backend de ativos (`app/assets/`) existe desde a Sprint 2 — CRUD completo
mais baixa por venda — e a associação despesa↔ativo (`asset_id`, com
sugestão automática) existe desde a Sprint 4. Nenhuma tela usa isso além de
um `<select>` de leitura na fila de Categorização. O usuário não tem como
cadastrar, editar, vender ou excluir um ativo pela interface, nem ver
quanto gastou com cada um — precisa ir direto no banco. Isso bloqueia
qualquer visão de patrimônio por ativo (cards Ativos/Passivos previstos
para a Sprint 9 dependem de haver dado real cadastrado via UI).

## Escopo

- **Incluído:**
  - `AssetsPage.tsx`: cards por ativo (`.dash-tile`), formulário de
    criar/editar (nome, tipo, valor atual, data de aquisição), ação de
    marcar venda (`valor_venda`/`data_venda`) e excluir ativo.
  - Filtro de período (ano/mês) igual às demais telas, escopando o
    drill-down de gasto — não a listagem de ativos em si.
  - Drill-down de custos por ativo: total gasto no período filtrado +
    lista de transações vinculadas (`asset_id`).
  - Ativos com `status=baixado` aparecem em seção separada, visualmente
    deslocada (opacidade reduzida), sem drill-down de gasto — mostram
    `valor_venda`/`data_venda`.
  - Novo endpoint `GET /dashboards/por-ativo?ano=&mes=` — total de despesa
    por ativo no período, mesmo padrão de `get_por_categoria`.
  - Novo filtro `asset_id` em `GET /pluggy/transactions`, mesmo padrão de
    `subcategory_id`/`account_tipo` já existentes — alimenta o nível
    "linha de extrato" do drill-down.
  - Extração de um componente `PeriodFilter` reaproveitado por
    `DashboardsPage`, `CategorizationReviewPage` e `AssetsPage` — o filtro
    ano/mês está hoje duplicado nas duas primeiras; esta sprint criaria a
    terceira cópia idêntica.
  - Testes automatizados (meta ≥80% cobertura nos módulos tocados).
- **Fora de escopo (explicitamente):**
  - Cards "Ativos"/"Passivos" no Dashboard, drilldown de despesas por
    passivo, `liability_id` em `pluggy_transactions` — Sprint 9 (E6 parte
    3), já registrado no roadmap com o gap de schema identificado.
  - Gestão de passivos (`liabilities`) pela UI — mesmo backend/padrão de
    `assets`, mas fora do escopo desta sprint (roadmap reserva
    especificamente "Gestão de Ativos").
  - Evolução de patrimônio/valor de ativo ao longo do tempo (série
    histórica) — precisaria de snapshot periódico, schema novo; segue
    adiado desde a Sprint 5/6.
  - Confirmar/editar `asset_sugerido_id` a partir desta tela — esse fluxo
    já existe na fila de Categorização (Sprint 4) e não muda aqui.

## Critérios de aceite

1. Dado um usuário autenticado, quando cria um ativo via `AssetsPage`
   (nome, tipo, valor atual, data de aquisição), então ele aparece como
   card na grid de ativos ativos.
2. Dado um ativo existente, quando o usuário edita nome/tipo/valor
   atual/data de aquisição, então o card reflete os novos valores.
3. Dado um ativo com `status=ativo`, quando o usuário marca venda
   (`valor_venda` + `data_venda`), então o ativo migra para a seção
   "Baixados" e uma segunda tentativa de venda falha (idempotência já
   garantida pelo backend desde a Sprint 2).
4. Dado um ativo, quando o usuário exclui, então ele some da listagem;
   transações que tinham `asset_id` apontando pra ele não são excluídas
   (só desassociadas).
5. Dado um usuário autenticado, quando chama
   `GET /dashboards/por-ativo?ano=&mes=`, então recebe o total de despesa
   por ativo no período, isolado por `user_id`.
6. Dado um ativo com transações vinculadas via `asset_id`, quando o
   usuário expande o drill-down do card no período filtrado, então vê o
   total batendo com `/dashboards/por-ativo` e a lista de transações
   batendo com `GET /pluggy/transactions?asset_id=&ano=&mes=`.
7. Dado dois usuários diferentes, quando cada um lista/cria/edita/vende/
   exclui ativos ou consulta `/dashboards/por-ativo`, então nunca vê ou
   altera dado do outro usuário.
8. Dado qualquer requisição às rotas novas sem cookie de sessão válido,
   então recebo 401.
9. Dado o CI, quando a suíte roda, então os testes novos (backend +
   frontend) passam com cobertura ≥80% nos módulos tocados.

## Regras de negócio

- Gasto por ativo (`/dashboards/por-ativo`) considera só transações de
  despesa (`tipo=debito`) — um ativo não "ganha" receita nesta modelagem
  (venda é tratada à parte, via `valor_venda`, fora da agregação de
  transações).
- Ao contrário de "não categorizado" nos dashboards por categoria, não há
  bucket "sem ativo" em `/dashboards/por-ativo` — a maioria das despesas
  não tem `asset_id`, e isso é esperado, não uma pendência de revisão.
- Excluir um ativo (`DELETE /assets/{id}`) nunca exclui transações — só
  desassocia (`asset_id`/`asset_sugerido_id` voltam a `NULL`) as que
  apontavam para ele, preservando o histórico de transação intacto.
- Filtro de período (ano/mês) na `AssetsPage` escopa apenas o cálculo de
  gasto exibido no drill-down — a listagem de ativos (quais cards
  aparecem) independe do período, mesmo padrão conceitual de "patrimônio
  atual" vs. totais filtrados já usado em `/dashboards/summary`.

## Dados e modelo

Nenhuma tabela ou coluna nova — reaproveita `assets` (Sprint 2) e os
campos `asset_id`/`asset_sugerido_id` já existentes em
`pluggy_transactions` (Sprint 4). Sem migration nesta sprint.

## Segurança

- Isolamento por usuário: `/dashboards/por-ativo` e o filtro `asset_id`
  em `/pluggy/transactions` seguem o mesmo padrão de todo endpoint
  existente (`Depends(get_current_user)`, filtro `user_id` em toda
  query).
- Nenhum secret novo introduzido nesta sprint.
- Nenhuma chamada a serviço externo nova.

## Fora de escopo / decisões adiadas

- Passivos pela UI, cards Ativos/Passivos no Dashboard, `liability_id` —
  Sprint 9.
- Série histórica de valor de ativo/patrimônio — adiado, precisa de job
  de snapshot novo.
- Dialog de confirmação destrutiva padronizado (excluir ativo) — esta
  sprint usa o nível de fricção já aceito no resto do app, sem introduzir
  um padrão de sistema novo para isso.

## Referências

- [docs/roadmap.md](../roadmap.md) (E6 parte 2)
- [PRD-002 — Dados mestres](PRD-002-dados-mestres-migracao-legado.md)
  (schema `assets`, CRUD original)
- [PRD-004 — Categorização automática](PRD-004-categorizacao-automatica.md)
  (`asset_id`/`asset_sugerido_id`, heurística de sugestão)
- [PRD-005 — Dashboards core](PRD-005-dashboards-core.md) (padrão de
  agregação `_base_query`/`_apply_periodo`, filtros de
  `/pluggy/transactions`)
- [DESIGN.md](../../DESIGN.md) (`.dash-tile`, accordion/drill-down)
- [ADR-001 — Stack](../architecture/adr/ADR-001-stack.md)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
