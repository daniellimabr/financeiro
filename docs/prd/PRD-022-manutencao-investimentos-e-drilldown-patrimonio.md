# PRD-022: Manutenção de Investimentos (categorização, contas XP, baseline) + drilldown completo de Ativos/Patrimônio

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, pedido direto do CEO usando o app na prática
  pós-Sprint 21, mesmo padrão das Sprints 16/17/18)
- **Sprint(s):** [SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-plan.md](../sprints/SPRINT-022-manutencao-investimentos-e-drilldown-patrimonio-plan.md)

## Problema

Quatro pontos levantados pelo CEO usando o app na prática pós-Sprint 21:

1. **Ruído de categorização:** transações internas de contas `tipo=investimento` continuam
   aparecendo na fila de Categorização — item já registrado como backlog em
   `docs/roadmap.md` ("Microtransações de investimento na fila de Categorização", feedback da
   sessão de execução da Sprint 21). O CEO prefere controlar aporte/resgate pela conta
   corrente de origem (Itaú/Nubank/XP), não precisa classificar a transação interna da
   holding.
2. **Dado morto de contas XP desativadas:** o CEO desativou (`sync_enabled=false`, mecanismo
   da Sprint 7) contas XP em `AccountManagementPage`, mas os dados sincronizados antes da
   desativação continuam no banco. Ele quer removê-los, e quer poder repetir essa limpeza no
   futuro sem pedir ajuda — não existe hoje nenhum endpoint de exclusão de conta.
3. **Anomalia na série histórica do Investimento "Quitar o AP":** a tela de série histórica
   mostra R$22.674,22 de "rendimento" em agosto/2026 (o CEO relatou como "valorização", mas o
   valor real está gravado no campo `rendimento` — holdings são todas `FIXED_INCOME`, então
   `valorizacao` fica corretamente zerada) — pico que não faz sentido para um CDB.
4. **Cards Ativos/Patrimônio desalinhados com o modelo mental do CEO:** ele considera
   Investimentos e Saldo Acumulado como parte do conceito de "Ativos" — quer isso refletido no
   drilldown do card Ativos. E quer que o card Patrimônio vire um drill-down completo e
   itemizado (valor real de ativos e passivos, não gasto/despesa do período).

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas na sessão de planejamento (2026-08-18), respondendo a perguntas diretas sobre os
3 pontos com mais de um caminho de implementação possível:

1. **Microtransações de investimento saem da fila E dos totais de Receita/Despesa** — mesmo
   tratamento hoje dado a "Transferência interna" (`category_groups.excluir_de_totais`,
   Sprint 5), não só ficam escondidas da revisão manual continuando a contar como "Não
   categorizado".
2. **Remoção de dados de conta vira funcionalidade reutilizável** — botão "Excluir conta" em
   Gestão de Contas, não um script pontual rodado uma vez só pelo CTO.
3. **O fix do rendimento de "Quitar o AP" reaudita o baseline das holdings suspeitas E
   redistribui o crescimento reconstruído mês a mês** — não é só uma nota explicativa na UI.

## Achado técnico que condiciona o escopo (investigação desta sessão de planejamento)

- **Card Ativos/Patrimônio:** `Summary.ativos`/`PatrimonioBreakdown.ativos`
  (`app/dashboards/service.py:26-32`, `_ativos_e_passivos` em `303-314`) somam **só** a
  tabela `assets` (imóvel/veículo/outro, Sprint 2/8) — separado de `saldo_investimentos` e
  `saldo_liquido_acumulado`. `_patrimonio_breakdown` (`341-384`) já expõe os 5 campos
  (`ativos, passivos, saldo_liquido_acumulado, saldo_investimentos, total`), e
  `PatrimonioBreakdownPanel` (`frontend/src/pages/DashboardsPage.tsx:768-846`) já renderiza
  essas 5 linhas com botão "Ver detalhe" (`804-832`) — mas cada botão hoje leva a telas
  desalinhadas com o pedido: "Ativos"/"Passivos" abrem `AtivosAccordion`/`PassivosAccordion`
  (gasto por ativo/passivo no período filtrado, não valor atual), "Saldo em investimentos"
  abre `SaldoPorContaList` **sem filtrar por tipo de conta** (todas as contas, não só
  investimento). Confirmado: adequar isso é **aditivo na UI** — não muda a fórmula de
  `Summary.ativos`/`patrimonio`, que já bate com `docs/dashboards-guia-cards.md` e não deve
  ser reaberta (evita dobrar contagem entre Ativos e Saldo em investimentos/Saldo acumulado).
- **Categorização:** `categorization/service.py::list_transactions` (`57-`) não filtra por
  tipo de conta hoje — não há join a `PluggyAccount`. O padrão de join já existe em
  `pluggy_integration/service.py::list_transactions` (usado por `GET /pluggy/transactions`,
  filtro `account_tipo`), e `dashboards/service.py::_base_query` (`219-267`) já tem dois
  precedentes de exclusão por tipo (cartão de crédito+crédito, Sprint 10;
  `category_groups.excluir_de_totais`, Sprint 5) reaproveitáveis para excluir
  `tipo=investimento` por padrão.
- **Contas XP desativadas:** não existe endpoint DELETE de `pluggy_accounts`/`pluggy_items`
  hoje (só `PUT .../accounts/{id}`). `PluggyAccount.transactions` tem
  `cascade="all, delete-orphan"` no ORM — deletar a conta já cascade-deleta
  `PluggyTransaction`. `PluggyInvestment` linka por `item_id`, não `account_id` — deletar uma
  conta desativada dentro de um item não toca holdings de outras contas do mesmo item.
  Precedente direto de desassociação de FK sem `ON DELETE` antes de excluir: `delete_asset`
  (`app/assets/service.py:64-77`) e `delete_liability` (`app/liabilities/service.py:68-82`).
- **Rendimento de "Quitar o AP" — causa raiz confirmada com dado real da VM de dev**
  (`investimento_id=5`, 14 holdings `FIXED_INCOME`): `reconstruct_historical_snapshots`
  (`app/pluggy_integration/service.py:365-387`) chama `_reconstruct_holding_snapshots`
  (`401-440`), que **zera `valorizacao`/`rendimento` por desenho** em todo mês reconstruído
  (jan-jul/2026, `confianca="reconstruido"`) — só move `saldo_acumulado` por
  aportes/resgates conhecidos (linha 425), decisão documentada no próprio docstring da
  Sprint 21 ("sem fonte de valorização histórica real"). `snapshot_current_month` (`484-546`),
  o job mensal, gravou agosto como o **primeiro snapshot `confianca="real"`** desse
  investimento: o resíduo (`residual = saldo_atual - saldo_anterior - aportes + resgates`,
  linha 525) usa como `saldo_anterior` o saldo de julho **reconstruído** (que nunca cresceu em
  8 meses por construção) — o resíduo inteiro (R$22.674,22) cai de uma vez em `rendimento` de
  agosto (linhas 526-532, ramo `else` para tipo≠EQUITY). Números reais consultados via SQL
  read-only na VM de dev (única prova concreta usada nesta sessão):

  | ano_mes | saldo | valorizacao | rendimento | aportes | resgates | confiança |
  |---|---|---|---|---|---|---|
  | 2026-01 | 55.530,53 | 0,00 | 0,00 | 5.000,00 | 10.036,37 | reconstruido |
  | 2026-02 | 55.122,98 | 0,00 | 0,00 | 12.309,47 | 12.717,02 | reconstruido |
  | 2026-03 | 45.088,97 | 0,00 | 0,00 | 0,00 | 10.034,01 | reconstruido |
  | 2026-04 | 44.635,28 | 0,00 | 0,00 | 13.383,41 | 13.837,10 | reconstruido |
  | 2026-05 a 07 | 44.635,28 (parado) | 0,00 | 0,00 | 0,00 | 0,00 | reconstruido |
  | **2026-08** | **67.309,50** | **0,00** | **22.674,22** | 0,00 | 0,00 | **real** |

  Confirmado com dado real: 4 das 14 holdings têm `saldo_inicial=R$0,00` mas `valor_atual`
  hoje >0 (R$13.802,53 / R$2.503,23 entre elas) — candidatas a baseline subestimado (a regra
  de confiança "alta" tratou "comprado após o baseline" como saldo=0 fato, mas o achado sugere
  que ao menos parte dessas posições já existia em dez/2025). Sanity check: R$67k de CDB a
  ~12%/ano renderia ~R$5,3k em 8 meses, não R$22,7k — gap de ~R$17k reforça a suspeita de
  baseline subestimado, além do efeito de acúmulo dos meses zerados.

## Escopo

### Incluído

- **Bloco 0 (investigação read-only obrigatória, dev VM):** contagem de transações
  pendentes/confirmadas em contas `tipo=investimento` por conector/conta (confirma volume e
  se a exclusão deve cobrir todas as contas de investimento — achado da Sprint 19: XP trouxe
  historicamente dividendo/JCP legítimo numa conta classificada `corrente`, que não deve ser
  afetada); listagem das contas XP com `sync_enabled=false` e contagem de linhas afetadas;
  campos ao vivo (`code`/`isin`/`purchaseDate`/`rate`/`fixedAnnualRate`) das 4 holdings
  "Quitar o AP" suspeitas de baseline subestimado, para decidir com o CEO se o baseline deve
  mudar antes da redistribuição.
- **Exclusão de microtransações de investimento:** `dashboards/service.py::_base_query` passa
  a excluir por padrão transações de conta `tipo=investimento` dos totais de Receita/Despesa
  (mesmo padrão da exclusão cartão de crédito+crédito). Mesma exclusão em
  `categorization/service.py::list_transactions` (join a `PluggyAccount`). Aporte/Resgate
  continuam contando normalmente — são transação da conta corrente de origem/destino, não da
  conta investimento (decisão já fixada na Sprint 19, não reaberta aqui).
- **"Excluir conta" reutilizável:** `DELETE /pluggy/accounts/{id}` + `delete_account`
  (desassocia `asset_id`/`asset_sugerido_id`/`liability_id`/`liability_sugerido_id`/
  `investimento_id`/`investimento_sugerido_id`/`descricao_sugestao_origem_id` antes de
  excluir, mesmo padrão de `delete_asset`/`delete_liability`); botão "Excluir conta" em
  `AccountManagementPage.tsx`, habilitado só quando a conta já está `sync_enabled=false`.
  Aplicado às contas XP reais desativadas na VM de dev, com aprovação explícita do CEO por
  comando antes de rodar.
- **Reauditoria de baseline + redistribuição do rendimento de "Quitar o AP":** ajuste pontual
  de `saldo_inicial` para as holdings com baseline suspeito (revisão humana, mesmo fluxo de
  `propose_baseline_dez_2025`/`confirm_baseline_dez_2025` já existente); mudança em
  `_reconstruct_holding_snapshots`/`snapshot_current_month` para distribuir o crescimento
  observado ao longo dos meses reconstruídos em vez de concentrá-lo inteiro no primeiro
  snapshot `confianca="real"`. Correção roda retroativamente sobre os snapshots
  `confianca="reconstruido"` já gravados (não são "mês fechado" no sentido de nunca terem
  refletido rendimento real) e é validada linha a linha com o CEO contra dado real.
- **Drilldown do card Ativos** ganha seções de valor atual por Investimento e saldo por conta
  (`useSaldoPorConta`, já existe), além do accordion de gasto por ativo já existente — sem
  mudar o número somado no card.
- **Drilldown do card Patrimônio** vira itemizado: os botões "Ver detalhe" de Ativos/Passivos
  passam a abrir lista de valor atual (reaproveitando `useAssets`/`useLiabilities`), e o de
  "Saldo em investimentos" passa a abrir a lista de Investimentos com valor atual, em vez de
  `SaldoPorContaList` sem filtro. "Saldo líquido acumulado" mantém o comportamento atual.

### Fora de escopo (explicitamente)

- Mudar a fórmula de `Summary.ativos`/`patrimonio` para somar investimentos/saldo diretamente
  dentro de "Ativos" — a mudança é só de apresentação/drilldown, preserva a soma documentada
  em `docs/dashboards-guia-cards.md`.
- Excluir dividendo/JCP legítimo (conta `corrente`) dos totais — só transações de conta
  `tipo=investimento` são afetadas pela exclusão.
- Sugestão automática para holdings CDB com nome idêntico/código nulo (limitação já registrada
  no roadmap desde a Sprint 21) — fora de escopo desta sprint.
- Integração com fonte de cotação histórica de mercado para ações (fora de escopo desde a
  Sprint 21, não revisitada aqui).
- Excluir conta ainda `sync_enabled=true` — a UI só habilita o botão para contas já
  desativadas, como salvaguarda contra exclusão acidental de dado ainda sincronizando.

## Critérios de aceite

1. Dado um sync ou consulta de transações pendentes, quando a transação pertence a uma conta
   `tipo=investimento`, então ela não aparece na fila de Categorização nem nos totais de
   Receita/Despesa — sem afetar transações de dividendo/JCP em contas `corrente`.
2. Dado o botão "Excluir conta" em `AccountManagementPage`, quando a conta está
   `sync_enabled=false` e o usuário confirma, então a conta e suas `pluggy_transactions` são
   removidas (com desassociação prévia de FKs de outras tabelas), sem afetar holdings do
   mesmo item vinculadas a outras contas.
3. Dado o botão "Excluir conta" numa conta ainda `sync_enabled=true`, então a ação fica
   indisponível/bloqueada na UI.
4. Dado o baseline reauditado e a redistribuição aplicada, quando a série histórica de
   "Quitar o AP" é consultada, então não há mais um pico artificial concentrado em um único
   mês — o total acumulado permanece igual à soma original observada, só distribuído.
5. Dado o card Ativos no Dashboard, quando o usuário abre o drilldown, então vê, além do gasto
   por ativo já existente, o valor atual por Investimento e o saldo por conta — sem mudança no
   valor numérico exibido no próprio card.
6. Dado o card Patrimônio no Dashboard, quando o usuário clica em "Ver detalhe" de
   Ativos/Passivos/Saldo em investimentos, então vê uma lista itemizada de valor atual (não
   mais gasto do período nem lista de contas sem filtro).
7. Dado dois usuários diferentes, todas as rotas/consultas novas ou alteradas continuam
   isoladas por `user_id`, sem exceção.
8. Dado qualquer requisição às rotas novas sem cookie de sessão válido, então recebo 401.
9. Dado o CI, quando a suíte roda, então os testes novos/alterados passam com cobertura ≥80%
   nos módulos tocados, suíte completa 100% verde.

## Regras de negócio

- Exclusão por tipo de conta (`investimento`) em `_base_query`/`list_transactions` segue o
  mesmo padrão dos dois precedentes existentes (cartão de crédito+crédito;
  `excluir_de_totais`) — filtro de query, nunca mutação de dado bruto.
- `delete_account` nunca deleta `PluggyInvestment`/`PluggyInvestmentTransaction` — holdings
  vivem no nível do item, não da conta; só a conta e suas `PluggyTransaction` são afetadas.
- Botão "Excluir conta" só fica habilitado para conta com `sync_enabled=false` — trava de UI,
  não só de backend, contra exclusão acidental.
- Redistribuição do crescimento reconstruído preserva o total observado (soma de
  `valorizacao`/`rendimento` mês a mês continua batendo com o resíduo real observado no
  primeiro snapshot `confianca="real"`) — é uma mudança de distribuição temporal, não de valor
  total.
- Baseline (`saldo_inicial`) só muda para as holdings especificamente revisadas com o CEO
  nesta sprint — as demais 10 holdings já aprovadas na Sprint 21 não são reabertas.
- Isolamento por usuário em toda rota/consulta nova ou alterada, mesmo padrão já usado em
  todo o projeto.

## Dados e modelo

- Sem tabela nova. Possível migration leve se a redistribuição do Bloco de rendimento exigir
  campo novo em `pluggy_investment_snapshots` para distinguir "snapshot original antes da
  correção" vs. "corrigido" (a decidir durante a execução, dependendo do algoritmo de
  redistribuição escolhido — se bastar recalcular in-place, nenhuma migration é necessária).
- Endpoint novo: `DELETE /pluggy/accounts/{id}`.
- Sem endpoint novo previsto para os drilldowns de Ativos/Patrimônio se `GET /investimentos`
  (já existente) cobrir valor atual por investimento — a decidir durante a execução.

## Segurança

- Isolamento por usuário em toda rota nova/alterada.
- `DELETE /pluggy/accounts/{id}` é uma exclusão real de dado — protegida por autenticação
  (401 sem cookie) e escopada ao usuário dono da conta (404 para conta de outro usuário),
  além da trava de UI de exigir `sync_enabled=false`.
- Nenhum secret novo introduzido.
- Aplicação real da exclusão nas contas XP na VM de dev exige aprovação explícita do CEO por
  comando (política do CLAUDE.md para exclusão de dados reais).

## Fora de escopo / decisões adiadas

- Sugestão automática para holdings com nome idêntico/código nulo (Sprint 21, ainda backlog).
- Fonte de cotação histórica de mercado para ações (Sprint 21, ainda fora de escopo).
- Sync agendado/automático (decisão fixa do CLAUDE.md).
- Excluir item Pluggy inteiro (não só uma conta) — fora de escopo, o pedido do CEO é sobre
  contas específicas desativadas, não sobre desconectar o item inteiro da XP.

## Referências

- [docs/roadmap.md](../roadmap.md) — item de backlog "Microtransações de investimento na fila
  de Categorização" (Sprint 21).
- [docs/dashboards-guia-cards.md](../dashboards-guia-cards.md) — definição vigente de
  Ativos/Passivos/Patrimônio, não alterada por esta sprint.
- [PRD-021 — Vínculo holdings↔Investimento + série histórica](PRD-021-vinculo-holdings-serie-historica.md)
  — baseline dez/2025, reconstrução retroativa, job de snapshot mensal (lógica reaberta
  pontualmente nesta sprint).
- [PRD-019 — Gestão de Investimentos](PRD-019-gestao-de-investimentos.md) — decisão de aporte/
  resgate contarem nos totais normais (não revisitada).
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) — procedimento do Bloco 0 de
  investigação na VM de dev.
- Plano de execução completo (decisões técnicas, arquivos críticos): plano de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-sprint-22-para-sunny-neumann.md` — a sessão de
  execução deve ler este PRD + o plano de sprint associado; não é necessário reler o plano de
  sessão bruto.
