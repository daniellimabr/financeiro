# PRD-009: Dashboards analíticos — Ativos/Passivos e refinamentos do funil

- **Status:** aprovado
- **Épico relacionado:** E6 — Dashboards analíticos, parte 3 ([docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-009](../sprints/SPRINT-009-dashboards-ativos-passivos-plan.md)

## Problema

O Dashboard principal (Sprint 5/6) mostra Receita/Despesa/Saldo/Patrimônio,
mas patrimônio é um número único — o usuário não vê quanto disso é ativo e
quanto é dívida, nem consegue abrir o detalhe de quais ativos/passivos
compõem o total sem ir na tela de Gestão de Ativos (Sprint 8, só ativos) ou
direto no banco (passivos não têm tela nenhuma). O card "Saldo" também é
inerte desde a Sprint 5, sem drill-down por conta. Separadamente, o funil de
drill-down (Sprint 6) acumulou 3 problemas reais reportados pelo CEO: o
nível "meio de pagamento" adiciona um clique sem agregar muita informação
(a maioria das contas tem pouca variedade de meio de pagamento por
categoria), os gráficos não têm tooltip (o usuário não consegue ler o valor
exato de um ponto sem abrir o drill-down completo), e não há como ordenar
as tabelas de transação por coluna.

## Escopo

- **Incluído:**
  - Novo schema `liability_id`/`liability_sugerido_id`/
    `liability_sugestao_confianca` em `pluggy_transactions`, espelhando
    `asset_id`/`asset_sugerido_id`/`asset_sugestao_confianca` (Sprint 4) —
    mesma heurística de sugestão automática (substring da descrição
    normalizada contra o nome do passivo), mesmo endpoint de confirmação
    manual (`PUT /categorization/transactions/{id}/liability`), mesmo
    filtro em `GET /pluggy/transactions?liability_id=`.
  - Cards "Ativos" e "Passivos" no resumo do Dashboard, somando
    `Asset.valor_atual`/`Liability.saldo_devedor` de itens ativos — os
    mesmos componentes que `_calcula_patrimonio` já soma internamente,
    agora expostos separadamente em `GET /dashboards/summary`.
  - Clicar em "Ativos" abre drill-down de receita/despesa por ativo no mês
    filtrado — reaproveita `GET /dashboards/por-ativo`/`.../tendencia`
    (Sprint 8) sem alteração de backend, só nova UI no Dashboard.
  - Clicar em "Passivos" abre drill-down de despesas por passivo no mês
    filtrado — só despesa, sem toggle receita (passivo não gera receita).
    Novo `GET /dashboards/por-passivo`/`.../tendencia`.
  - Clicar em "Saldo" abre drill-down de saldo por conta — sempre o
    snapshot atual, **ignora o filtro de período** (mesmo padrão conceitual
    do card "Patrimônio", rotulado "atual"; não há histórico de saldo no
    schema). Novo `GET /dashboards/saldo-por-conta`, sem parâmetros. Conta
    de cartão de crédito mostra a soma da fatura atual não paga, com o
    limite de crédito entre parênteses — **revisado após a entrega
    inicial** (ver nota abaixo).
  - Tooltip (hover) nos gráficos de tendência e sparkline.
  - Eixo X reduzido/simplificado nos gráficos de tendência — **revisado
    após a entrega inicial**: rotula só os meses de início de trimestre.
  - Remoção do gráfico de barras redundante acima de cada lista do
    drill-down (mantém só a lista com barra de preenchimento).
  - Remoção do nível "meio de pagamento" do funil — o meio de pagamento
    passa a aparecer como um ícone por linha (SVG inline, sem biblioteca
    nova), ao lado do valor — **revisado após a entrega inicial**: em vez
    de categoria expandir direto para a lista de transações, o funil
    ganhou um nível de agrupamento — Categoria (grupo) > Tipo
    (subcategoria) > Transação — com cores distintas por Categoria e por
    Tipo (ver nota abaixo).
  - Ordenação por coluna (clique no cabeçalho) nas tabelas de transação do
    Dashboard, incluindo a coluna % — **revisado após a entrega inicial**.
  - Extração de `CardSparkline`/`TrendChart` compartilhados
    (`DashboardsPage`/`AssetsPage` duplicavam o primeiro; o segundo passa a
    ser necessário em 3+ lugares) — mesmo gatilho de duplicação que já
    motivou a extração de `PeriodFilter` na Sprint 8.
  - Testes automatizados (meta ≥80% cobertura nos módulos tocados).
- **Fora de escopo (explicitamente):**
  - CRUD de passivos pela UI — só a associação transação↔passivo entra
    (schema, sugestão automática, filtro, drill-down de leitura). Gestão
    de passivos fica para quando o roadmap priorizar.
  - Série histórica de saldo/patrimônio/valor de ativo — sem snapshot
    periódico, mesma limitação registrada desde PRD-005/006.
  - Qualquer biblioteca de ícones nova — decisão do CEO nesta sessão de
    planejamento (SVG inline, sem dependência nova de frontend).
  - Toggle despesa/receita no drill-down de Passivos — só despesa.
  - Endpoint de fatura/bill da Pluggy — não usado pelo client atual; a
    soma da fatura atual (revisão pós-entrega) é aproximada a partir das
    próprias `pluggy_transactions`, não de um dado de fatura importado.

> **Nota de revisão (2026-08-15, mesma sessão de execução):** o CEO deu
> feedback ao ver o resultado real da entrega inicial, antes de aprovar a
> sprint. Mudanças: (1) o funil de Despesa/Receita ganhou o nível
> Categoria > Tipo (em vez de expandir direto pra transação) — calculado
> no frontend a partir do `GET /dashboards/por-categoria` já existente,
> sem endpoint novo; (2) Categoria e Tipo ganharam cores distintas (paleta
> categórica validada via skill `dataviz`), corrigindo o funil que usava
> uma única cor despesa/receita para todas as linhas; (3) o ícone de meio
> de pagamento passou a ficar dentro da célula Valor, não numa coluna
> própria; (4) a coluna % das tabelas de transação também ficou ordenável;
> (5) `CardSparkline` ganhou tooltip e o eixo X do `TrendChart` passou a
> rotular só trimestres; (6) investigação do payload real da Pluggy
> (`creditData`) confirmou que `balance` já representa a dívida do cartão
> (achado da Sprint 5, correto — não o limite, como o CEO havia
> percebido), mas o card "Saldo" passou a mostrar a soma dos itens da
> fatura atual não paga (aproximada por uma janela mensal ancorada no
> vencimento, já que a Pluggy não expõe fechamento de fatura nem endpoint
> de bill) com o limite de crédito entre parênteses (migration `0010`,
> novo `limite_credito`/`fatura_vencimento` em `pluggy_accounts`). Os
> itens marcados acima foram implementados já revisados; Critérios de
> aceite e Regras de negócio abaixo refletem o escopo final.

## Critérios de aceite

1. Dado um usuário autenticado com ativos/passivos cadastrados, quando
   consulta `GET /dashboards/summary`, então a resposta inclui `ativos` e
   `passivos` (soma de itens com `status=ativo`), consistentes com o
   `patrimonio` já retornado (mesma base de cálculo).
2. Dado o Dashboard aberto, então os cards "Ativos" e "Passivos" aparecem
   ao lado dos já existentes, e clicar em cada um abre o drill-down
   correspondente (Ativos com toggle despesa/receita reaproveitando
   Sprint 8; Passivos só despesa).
3. Dado o card "Saldo", quando o usuário clica, então vê o saldo atual por
   conta, e trocar o filtro de ano/mês do Dashboard **não** altera esse
   drill-down (sempre snapshot atual).
4. Dado uma transação com `liability_id` associado, quando aparece no
   drill-down de Passivos, então soma corretamente no total do passivo e
   nunca aparece se o `tipo` for crédito.
5. Dado o motor de sugestão automática, quando uma transação pendente tem
   descrição normalizada contendo o nome de um passivo do usuário, então
   `liability_sugerido_id`/`liability_sugestao_confianca` são preenchidos
   (mesma heurística de `asset_sugerido_id`).
6. Dado `PUT /categorization/transactions/{id}/liability`, quando o
   passivo pertence a outro usuário ou não existe, então retorna 404;
   quando válido, associa a transação (`liability_id`) sem alterar
   `asset_id`/`subcategory_id`.
7. Dado `DELETE /liabilities/{id}` com transações vinculadas via
   `liability_id`/`liability_sugerido_id`, então o passivo é excluído e as
   transações são desassociadas (`NULL`), nunca excluídas — mesmo
   comportamento de `delete_asset` (Sprint 8).
8. Dado o funil de Despesa/Receita aberto, então expande em dois níveis —
   Categoria (grupo) e, dentro dela, Tipo (subcategoria) — antes de chegar
   na lista de transações (sem nível "meio de pagamento" intermediário);
   cada linha de transação mostra um ícone do meio de pagamento ao lado do
   valor; Categoria e Tipo têm cores visualmente distintas entre si.
9. Dado uma tabela de transações no Dashboard, quando o usuário clica num
   cabeçalho de coluna (incluindo a coluna %), então a tabela reordena por
   aquela coluna (asc/desc alternando a cada clique).
10. Dado qualquer gráfico de tendência/sparkline, quando o usuário passa o
    mouse sobre um ponto, então um tooltip mostra o valor exato; o eixo X
    do gráfico de tendência rotula só os meses de início de trimestre.
11. Dado o card "Saldo" com uma conta de cartão de crédito, então mostra a
    soma dos itens não pagos da fatura atual (não o saldo bruto da conta)
    com o limite de crédito entre parênteses.
12. Dado dois usuários diferentes, quando cada um consulta os endpoints
    novos (`por-passivo`, `saldo-por-conta`, filtro `liability_id`), então
    nunca vê dado do outro usuário.
13. Dado qualquer requisição às rotas novas sem cookie de sessão válido,
    então recebo 401.
14. Dado o CI, quando a suíte roda, então os testes novos (backend +
    frontend) passam com cobertura ≥80% nos módulos tocados.

## Regras de negócio

- `GET /dashboards/por-passivo`/`.../tendencia` **não expõem parâmetro
  `tipo`** — sempre despesa (`tipo=debito` interno, nunca configurável),
  diferente de `/por-ativo` que aceita o toggle desde a Sprint 8.
- `GET /dashboards/saldo-por-conta` não aceita `ano`/`mes` — é sempre
  snapshot atual, mesmo padrão conceitual do campo `patrimonio` em
  `/dashboards/summary` (rotulado "atual" na UI). Para conta corrente/
  poupança/investimento, o valor é `PluggyAccount.saldo`; para cartão de
  crédito com `fatura_vencimento` conhecido, é a soma dos débitos da
  conta na janela `(fatura_vencimento - 1 mês, fatura_vencimento]`
  (aproximação da fatura atual não paga — a Pluggy não expõe fechamento
  de fatura nem endpoint de bill separado); sem `fatura_vencimento`
  (conector não trouxe `creditData`), cai de volta pro saldo bruto.
- `ativos`/`passivos` em `/dashboards/summary` usam o mesmo filtro
  `status=ativo` que `_calcula_patrimonio` já usa internamente — não uma
  soma de todos os itens (incluindo baixados/quitados).
- Excluir um passivo (`DELETE /liabilities/{id}`) nunca exclui transações
  — só desassocia (`liability_id`/`liability_sugerido_id` voltam a
  `NULL`), mesma regra de `delete_asset`.
- Percentual em cada nível do funil de Despesa/Receita é sempre contra o
  total do nível imediatamente acima: Categoria (grupo) contra o total
  geral do tipo (débito/crédito) no período; Tipo (subcategoria) contra o
  total da Categoria que o contém; linha de extrato contra o total do
  Tipo. Nenhum nível usa mais o total do meio de pagamento (que deixou de
  ser um nível do funil).
- Cor de Categoria e Tipo é atribuída por **identidade** (id do grupo/
  subcategoria em ordem estável), nunca por ranking do período — a mesma
  categoria mantém a mesma cor independente do filtro ano/mês ou de
  quantos itens aparecem naquele mês.
- Ícone de meio de pagamento por linha é decorativo (SVG inline,
  `aria-hidden`), não substitui nenhuma informação textual já disponível.

## Dados e modelo

- Migration `0009` (reversível): `liability_id`, `liability_sugerido_id`
  (FK `liabilities.id`, nullable), `liability_sugestao_confianca`
  (string, nullable) em `pluggy_transactions` — mesmo padrão simples das
  colunas de `asset_id` (migration `0006`), sem enum, sem índice novo.
- Migration `0010` (reversível, revisão pós-entrega): `limite_credito`
  (Numeric, nullable), `fatura_vencimento` (Date, nullable) em
  `pluggy_accounts` — lidos de `creditData.creditLimit`/
  `creditData.balanceDueDate` no payload da Pluggy (já chegava no sync,
  antes descartado); `NULL` para conta que não é cartão de crédito ou cujo
  conector não retornou `creditData`.
- Nenhuma tabela nova. `assets`/`liabilities` (Sprint 2) e
  `pluggy_accounts`/`pluggy_transactions` (Sprint 3+) são reaproveitados.

## Segurança

- Isolamento por usuário: todos os endpoints novos (`por-passivo`,
  `saldo-por-conta`, filtro `liability_id`, `PUT .../liability`) seguem o
  mesmo padrão de `Depends(get_current_user)` + filtro `user_id` já usado
  em todo o projeto.
- Nenhum secret novo. Nenhuma chamada a serviço externo nova.

## Fora de escopo / decisões adiadas

- Gestão de passivos pela UI (CRUD) — fica para sprint futura, mesmo
  padrão de `assets` quando priorizado.
- Série histórica de saldo/patrimônio — precisa de snapshot periódico
  (job novo), adiado desde PRD-005/006.
- Biblioteca de ícones — rejeitada nesta sessão em favor de SVG inline,
  evitando depender de aprovação de plugin novo fora do fluxo padrão.

## Referências

- [docs/roadmap.md](../roadmap.md) (E6 parte 3)
- [PRD-004 — Categorização automática](PRD-004-categorizacao-automatica.md)
  (heurística de sugestão de `asset_id`, espelhada aqui para `liability_id`)
- [PRD-005 — Dashboards core](PRD-005-dashboards-core.md) (`_calcula_patrimonio`,
  limitação de série histórica de saldo)
- [PRD-006 — Dashboards analíticos](PRD-006-dashboards-analiticos.md)
  (funil sanfona, tendência, percentual — refinado aqui)
- [PRD-008 — Gestão de Ativos](PRD-008-gestao-de-ativos.md) (`/dashboards/por-ativo`,
  reaproveitado sem alteração; `PeriodFilter`, precedente de extração de
  componente)
- [DESIGN.md](../../DESIGN.md)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
