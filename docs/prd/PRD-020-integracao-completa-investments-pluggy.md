# PRD-020: Integração completa de Investments da Pluggy

- **Status:** aprovado
- **Épico relacionado:** nenhum (item registrado em "Registro de reavaliações futuras" a
  partir do achado do Bloco 3 da Sprint 19, formalizado nesta sessão de planejamento,
  2026-08-17)
- **Sprint(s):** [SPRINT-020-integracao-completa-investments-pluggy-plan.md](../sprints/SPRINT-020-integracao-completa-investments-pluggy-plan.md)

## Problema

Achado real do Bloco 3 da Sprint 19 (investigação read-only na VM de dev, com Nubank
Investimentos e XP conectadas e sincronizadas): o item **Nubank Investimentos** sincroniza
sem erro (`POST /items/{id}/sync` retorna `status=updated`), mas o endpoint genérico
`GET /accounts` da Pluggy retorna **zero contas** para ele — hoje esse investimento é
completamente invisível no sistema, sem nenhuma `PluggyAccount` para vincular a um
`Investimento`. O item **XP** retorna 3 contas (2 `corrente` + 1 `cartao_credito`), nenhuma
classificada `tipo=investimento` por `_map_account_tipo`, mas uma das contas `corrente`
carrega dezenas de transações reais de dividendos/JCP (`categoria_pluggy =
"Proceeds interests and dividends"`/`"Taxes on investments"`, citando tickers reais como
TAEE11, BBSE3, VALE3, HAPV3) — esse rendimento *incidental* já flui pelo `GET /transactions`
genérico já integrado.

A visão completa de posições/holdings que o CEO tinha no v1 (CDBs, ações, "Caixinha
Nubank") não existe hoje e não pode ser reconstruída a partir dos endpoints bancários
genéricos — exige as rotas dedicadas de Investments da Pluggy, `GET /investments` e
`GET /investments/transactions`, **nunca chamadas neste projeto**. A Sprint 19 (Gestão de
Investimentos, Blocos 1+2) já entregou o agrupamento lógico `Investimento` e a categorização
de Aporte/Resgate — esta sprint fecha a lacuna de holdings identificada no Bloco 3 daquela
sprint.

## Decisões do CEO (não reabrir sem pedido explícito)

1. **Escopo cobre posições/holdings E histórico de transações por posição** — não só o
   snapshot de saldo atual (`GET /investments`), mas também compra/venda/proventos por
   posição individual (`GET /investments/transactions`). Decisão explícita, escolhendo o
   escopo maior entre as duas opções apresentadas nesta sessão de planejamento.
2. **Vínculo ao agrupamento `Investimento` é direto na holding** — nova coluna
   `investimento_id` na tabela de holdings nova, mesmo padrão já usado em
   `pluggy_accounts`/`pluggy_transactions` (Sprint 19), sem depender de existir uma
   `PluggyAccount` associada. Necessário porque "Nubank Investimentos" não tem nenhuma
   `PluggyAccount` — não haveria carteira para vincular no modelo antigo.
3. **`saldo_investimentos` do card Patrimônio passa a somar as holdings novas** — fecha a
   lacuna real: hoje "Nubank Investimentos" é invisível no Patrimônio porque
   `_patrimonio_breakdown` só soma `PluggyAccount.saldo` de contas `tipo=investimento`.

## Escopo

- **Incluído:**
  - `PluggyClient` ganha `get_investments(pluggy_item_id)` e
    `get_investment_transactions(pluggy_investment_id, from_date=None)`.
  - **Bloco de investigação read-only obrigatório** contra os itens reais já conectados na
    VM de dev (Nubank Investimentos, XP) **antes** de fechar o schema definitivo — mesmo
    princípio já usado no Bloco 3 da Sprint 19 (nunca implementar às cegas).
  - Duas tabelas novas: `pluggy_investments` (holdings/posições) e
    `pluggy_investment_transactions` (histórico de compra/venda/provento por posição).
  - Sync (`sync_item`) estendido para popular as duas tabelas novas para todo item, mesmo
    os que também retornam contas via `/accounts` (XP).
  - CRUD de vínculo holding→Investimento (`investimento_id`) e edição de `saldo_inicial`
    por holding (mesma "visão-base" já usada em `PluggyAccount.saldo_inicial`, Sprint 15).
  - `app/investimentos/service.py::get_evolucao` estendido para somar holdings vinculadas
    (`saldo_base`/`saldo_atual`), sem mudar a fórmula de `rendimento_estimado`.
  - `app/dashboards/service.py::_patrimonio_breakdown` estendido: `saldo_investimentos`
    passa a somar holdings além de contas `tipo=investimento`, sem dobrar contagem para um
    mesmo item.
  - Frontend: lista de "Posições de investimento" em `AccountManagementPage.tsx` (vínculo +
    saldo inicial), nova view "Posições" no drilldown de `InvestimentosPage.tsx` (tabela de
    holdings com histórico de transações expansível por linha), card do investimento
    passa a listar também as posições vinculadas.
  - Testes automatizados (meta ≥80% cobertura nos módulos tocados), incluindo regressão
    explícita de Patrimônio para contas/itens sem holdings.
- **Fora de escopo (explicitamente):**
  - Subcategoria "Rendimento" condicional (adiada na Sprint 19) — não reaberta aqui; o
    rendimento incidental de dividendos/JCP continua fluindo só pelo `GET /transactions`
    genérico já integrado. Se o CEO quiser reavaliar isso à luz do dado novo de holdings,
    é uma decisão separada, não presumida por esta sprint.
  - Trava de tipo de conta no vínculo carteira→investimento (backend) — mesmo adiamento já
    registrado no PRD-019, não revisitado aqui.
  - Qualquer chamada a rotas de Investments além de `/investments` e
    `/investments/transactions` (ex.: simulação/projeção de rentabilidade) — fora do
    achado original e fora do pedido desta sessão.

## Critérios de aceite

1. Dado um item Pluggy sincronizado que não retorna nenhuma conta via `GET /accounts`
   (caso real: Nubank Investimentos), quando o sync roda, então suas posições aparecem via
   `GET /investments` e ficam disponíveis para vínculo a um `Investimento`, sem depender de
   nenhuma `PluggyAccount`.
2. Dado um item Pluggy que retorna contas e também holdings (caso real: XP), quando o sync
   roda, então ambos os fluxos populam suas tabelas respectivas sem conflito nem duplicação.
3. Dado uma posição vinculada a um `Investimento`, quando o usuário consulta
   `GET /investimentos/{id}/evolucao`, então `saldo_base`/`saldo_atual` refletem a posição
   (via `saldo_inicial`/`valor_atual`), com `rendimento_estimado` calculado pela mesma
   fórmula já existente.
4. Dado uma posição vinculada, quando o usuário abre a view "Posições" no drilldown de
   `InvestimentosPage`, então vê a posição (tipo, nome/código, quantidade, valor atual) e,
   ao expandir, o histórico de transações dessa posição via
   `GET /pluggy/investments/{id}/transactions`.
5. Dado o card Patrimônio, quando existem holdings vinculadas a um usuário, então
   `saldo_investimentos` soma essas holdings; para itens que só têm conta
   `tipo=investimento` (sem holdings), o comportamento anterior (soma de
   `PluggyAccount.saldo`) é preservado sem dobrar contagem caso um item tenha as duas
   fontes simultaneamente.
6. Dado dois usuários diferentes, quando cada um sincroniza, vincula ou consulta holdings/
   transações de investimento, então nunca vê ou altera dado do outro usuário.
7. Dado qualquer requisição às rotas novas sem cookie de sessão válido, então recebo 401.
8. Dado o CI, quando a suíte roda, então os testes novos (backend + frontend) passam com
   cobertura ≥80% nos módulos tocados, incluindo teste de regressão de Patrimônio para
   contas/usuários sem holdings.

## Regras de negócio

- `pluggy_investment_transactions` é um ledger interno da posição, **paralelo** a
  `pluggy_transactions` — não entra em `_base_query` nem nos totais de Despesa/Receita.
  Não há risco de dobrar o aporte/resgate já capturado na conta corrente de origem/destino
  (decisão 1 do PRD-019, inalterada).
- `tipo`/`subtipo` das holdings e das transações de investimento são armazenados como
  `String` livre (não `Enum` Python) — a taxonomia de tipos de investimento da Pluggy é
  maior e mais volátil que `PluggyAccountTipo`; um enum rígido forçaria uma migration a
  cada tipo novo de investimento retornado pela Pluggy.
- Uma holding pertence a no máximo um `Investimento` por vez, vínculo direto via
  `investimento_id` (sem tabela de junção) — mesmo padrão já usado para
  `pluggy_accounts.investimento_id`.
- `saldo_investimentos` no card Patrimônio: para cada item Pluggy, holdings (quando
  existirem) são a fonte preferencial; contas `tipo=investimento` só entram na soma para
  itens **sem** nenhuma holding — evita dobrar contagem se um item futuro retornar as duas
  coisas para o mesmo saldo. Pressuposto a confirmar contra o dado real do Bloco 1 antes de
  fechar a query (hoje, nenhum item conhecido tem as duas fontes simultaneamente).
- Toda investigação de dado real (Bloco 1) segue o mesmo padrão de causa-raiz já usado nas
  Sprints 10/15/16/17/18/19: nunca implementar às cegas, confirmar contra dado real antes
  de decidir, e voltar ao CEO se a causa tocar uma decisão já fechada.

## Dados e modelo

- Migration nova (`0016`): tabelas `pluggy_investments` e `pluggy_investment_transactions`.
- `pluggy_investments`: `id`, `item_id` (FK `pluggy_items`), `user_id`,
  `pluggy_investment_id` (unique), `tipo`/`subtipo` (`String`), `nome`, `codigo` (ticker/
  ISIN, nullable), `quantidade` (`Numeric`, nullable), `valor_investido` (nullable),
  `valor_atual`, `saldo_inicial` (nullable — visão-base, mesmo papel de
  `PluggyAccount.saldo_inicial`), `moeda`, `investimento_id` (FK nullable),
  `created_at`/`updated_at`.
- `pluggy_investment_transactions`: `id`, `investment_id` (FK `pluggy_investments`),
  `user_id`, `pluggy_investment_transaction_id` (unique), `tipo` (`String`), `descricao`,
  `valor`, `quantidade` (nullable), `data`, `created_at`/`updated_at`.
- Schema acima é um **rascunho informado pela API pública da Pluggy**, sujeito a ajuste
  pelo achado real do Bloco 1 desta sprint antes de a migration ser escrita — mesmo
  princípio da migration condicional `0016` originalmente reservada (e não usada) na
  Sprint 19.

## Segurança

- Isolamento por usuário em toda tabela/endpoint novo: filtro `user_id` em toda query,
  mesmo padrão já usado em `pluggy_accounts`/`pluggy_transactions`/`investimentos`.
- Nenhum secret novo introduzido — reaproveita as credenciais Pluggy já configuradas.
- Chamadas novas (`GET /investments`, `GET /investments/transactions`) usam o mesmo cliente
  autenticado (`PluggyClient`) já existente, sem rota/credencial nova.
- Investigação do Bloco 1 na VM de dev segue o mesmo mecanismo já usado no Bloco 3 da
  Sprint 19 (JWT gerado dentro do próprio container da API, nunca bypass de auth),
  estritamente read-only.

## Fora de escopo / decisões adiadas

- Subcategoria "Rendimento" condicional — segue adiada, decisão explícita do PRD-019, não
  reaberta nesta sprint.
- Trava de tipo de conta no backend para vínculo carteira→investimento — segue só filtro de
  UI, mesmo adiamento do PRD-019.
- Simulação/projeção de rentabilidade de investimento — fora do achado original, fora desta
  sprint.

## Referências

- [docs/roadmap.md](../roadmap.md) — "Registro de reavaliações futuras" (item Integração
  completa de Investments da Pluggy, origem Sprint 19).
- [SPRINT-019-gestao-de-investimentos-report.md](../sprints/SPRINT-019-gestao-de-investimentos-report.md)
  — achados do Bloco 3 (origem do problema desta sprint).
- [PRD-019 — Gestão de Investimentos](PRD-019-gestao-de-investimentos.md) — agrupamento
  `Investimento`, padrão de vínculo `investimento_id`, `rendimento_estimado`, decisão 1
  (Aporte/Resgate não excluídos de totais).
- [PRD-016 — Regime competência/caixa, Patrimônio](PRD-016-regime-competencia-caixa-patrimonio.md)
  — origem de `saldo_investimentos` em `_patrimonio_breakdown`.
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) — procedimento para o Bloco 1 de
  investigação na VM de dev.
- Plano de execução completo (decisões técnicas, arquivos críticos): plano de sessão salvo
  em `C:\Users\Daniel\.claude\plans\planejar-sprint-para-integracao-nested-yao.md` — a
  sessão de execução deve ler este PRD + o plano de sprint associado; não é necessário
  reler o plano de sessão bruto.
