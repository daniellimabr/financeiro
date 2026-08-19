# PRD-023: Investimentos — drilldown de posições e extrato unificado

- **Status:** aprovado
- **Épico relacionado:** nenhum (cross-epic, pedido direto do CEO usando `InvestimentosPage` na
  prática pós-Sprint 22, mesmo padrão das Sprints 16/17/18/22)
- **Sprint(s):** [SPRINT-023-investimentos-drilldown-extrato-unificado-plan.md](../sprints/SPRINT-023-investimentos-drilldown-extrato-unificado-plan.md)

## Problema

Dois pontos reportados pelo CEO usando a tela de Investimentos na prática:

1. **Cards poluídos e overlap de colunas:** os cards de Investimento exibem a lista de
   carteiras/posições vinculadas como texto corrido dentro do próprio card
   (`<span className="tag">Posições: ...</span>` / `Carteiras: ...`) — poluição visual. O botão
   "Posições" já existe como uma das 3 abas do drilldown expandido (Extrato/Posições/Série
   histórica), mas só é alcançado depois de abrir o drilldown pela aba "Extrato" (default) — não
   é o ponto de entrada, apesar de já cobrir o propósito de "ver a composição do investimento" que
   o texto solto no card tenta resumir. Além disso, as tabelas dessa aba
   (`InvestimentoPosicoes`, `PosicaoHistorico`) são as únicas `.dash-table` do projeto sem
   `<colgroup>` — convenção obrigatória desde a Sprint 13 — causando texto de coluna (ex. nome de
   holding longo) vazando visualmente sobre a coluna vizinha.
2. **Extrato vazio para investimentos só-holdings:** o botão "Extrato" não mostra nenhum
   movimento para investimentos compostos só por holdings, sem conta corrente vinculada — ex.
   "Quitar o AP" (14 CDBs Nubank). Causa raiz: o extrato de hoje só lê
   `PluggyTransaction.investimento_id` (transação bancária categorizada Aporte/Resgate), nunca
   `PluggyInvestmentTransaction` (movimento por holding — aporte/resgate de CDB, por exemplo). Um
   investimento sem carteira bancária vinculada nunca tem a primeira fonte populada, mesmo tendo
   movimento real nas holdings.

## Escopo

### Incluído

- **Bloco 0 (investigação read-only obrigatória, dev VM):** consultar via `scripts/ssh_vm.py` os
  dados reais de `PluggyInvestmentTransaction` do investimento "Quitar o AP"
  (`investimento_id=5`, 14 holdings) — confirmar campos (`tipo`, `descricao`, `valor`, `data`),
  intervalo de datas coberto (o CEO espera ver movimento desde o início do ano) e volume — antes
  de fechar o formato de resposta do endpoint novo.
- **Endpoint de extrato unificado:** `GET /investimentos/{id}/transacoes?ano=&mes=` novo, unindo:
  (a) `PluggyTransaction` do usuário com `investimento_id == id` (fonte já usada hoje pelo
  extrato); (b) `PluggyInvestmentTransaction` de toda `PluggyInvestment` com
  `investimento_id == id` (join por holding, fonte que faltava). `ano`/`mes` opcionais (mesmo
  padrão de filtro já usado em `list_transactions`), resultado ordenado por data desc.
- **Card de Investimento:** remove os dois `<span className="tag">` de "Carteiras"/"Posições"
  (texto corrido). O botão de ação do card passa a abrir o drilldown já com a view "Posições"
  como entrada — Extrato e Série histórica continuam acessíveis como toggles dentro do mesmo
  painel, sem mudança estrutural nessa parte.
- **Fix de overlap:** `<colgroup>` + classes de largura dedicadas (mesmo padrão de
  `.serie-historica-table .col-*`) para `InvestimentoPosicoes` e `PosicaoHistorico`.

### Fora de escopo (explicitamente)

- Sugestão automática para holdings CDB com nome idêntico/código nulo (backlog desde a Sprint 21,
  não reaberto aqui).
- Mudar `get_evolucao`/`get_evolucao_mensal` (fórmula de saldo/rendimento) — esta sprint só
  adiciona uma via de leitura de transações para exibição, sem tocar cálculo de evolução.
- Paginação do extrato unificado — volume observado até aqui é baixo (dezenas de transações por
  investimento); se o Bloco 0 revelar volume alto o suficiente para justificar paginação, isso
  vira achado real da execução, registrado no relatório, não presumido agora.
- Editar/categorizar transações de holding a partir do extrato unificado (`PluggyInvestmentTransaction`
  não tem os mesmos campos editáveis de `PluggyTransaction` — a tabela é só leitura).

## Critérios de aceite

1. Dado um investimento só-com-holdings (ex. "Quitar o AP"), quando o usuário abre o extrato
   filtrado por um período com movimento real, então as transações de holding aparecem
   (data/tipo/descrição/valor) — hoje isso resulta em lista vazia.
2. Dado um investimento com carteira bancária vinculada, quando o extrato é aberto, então
   continua mostrando as transações já suportadas hoje (sem regressão).
3. Dado o card de Investimento, quando clicado, então abre direto na visão "Posições" (não mais
   "Extrato" por default), sem texto de posições/carteiras solto no corpo do card.
4. Dado qualquer tabela de posições ou histórico de posição, quando renderizada com nome de
   holding longo, então nenhuma coluna vaza visualmente sobre a vizinha.
5. Dado dois usuários diferentes, o endpoint novo e as consultas alteradas continuam isolados por
   `user_id`, sem exceção.
6. Dado qualquer requisição ao endpoint novo sem cookie de sessão válido, então recebo 401; dado
   um `investimento_id` de outro usuário, então recebo 404.
7. Dado o CI, quando a suíte roda, então os testes novos/alterados passam com cobertura ≥80% nos
   módulos tocados, suíte completa 100% verde.

## Regras de negócio

- O extrato unificado é uma leitura agregada — não altera `PluggyTransaction` nem
  `PluggyInvestmentTransaction`, nem a fórmula de `get_evolucao`/`get_evolucao_mensal`.
- Origem de cada linha do extrato (`"conta"` vs `"holding"`) é explícita na resposta, para o
  frontend poder rotular/distinguir sem heurística.
- Isolamento por usuário: o join de holdings passa sempre por `PluggyInvestment.user_id`, mesmo
  padrão já usado em `list_investment_transactions`.

## Dados e modelo

- Sem tabela nova, sem migration.
- Endpoint novo: `GET /investimentos/{id}/transacoes?ano=&mes=` em
  `backend/app/investimentos/router.py`.
- Schema novo: `InvestimentoTransacaoOut` (data, tipo, descricao, valor, origem:
  `"conta" | "holding"`, holding_nome opcional) em `backend/app/schemas/investimento.py`.
- Serviço novo: `get_transacoes` em `backend/app/investimentos/service.py`, unindo
  `PluggyTransaction` (via `investimento_id`) e `PluggyInvestmentTransaction` (via join em
  `PluggyInvestment.investimento_id`).

## Segurança

- Isolamento por usuário em toda consulta nova (mesmo padrão de `get_evolucao`).
- Endpoint novo protegido por autenticação (401 sem cookie), escopado ao usuário dono do
  investimento (404 cross-user).
- Nenhum secret novo introduzido.

## Fora de escopo / decisões adiadas

- Paginação do extrato — decisão adiada até o Bloco 0 confirmar volume real.
- Edição de transações de holding — fora de escopo, tabela `PluggyInvestmentTransaction` é
  espelho read-only do payload da Pluggy.
- Sugestão automática de vínculo holding→Investimento para CDBs de nome idêntico — backlog
  registrado desde a Sprint 21, não revisitado.

## Referências

- [docs/roadmap.md](../roadmap.md) — Sprints 19-22 (histórico de Gestão de Investimentos).
- [PRD-020 — Integração completa de Investments da Pluggy](PRD-020-integracao-completa-investments-pluggy.md)
  — origem de `PluggyInvestment`/`PluggyInvestmentTransaction`.
- [PRD-021 — Vínculo holdings↔Investimento + série histórica](PRD-021-vinculo-holdings-serie-historica.md)
  — origem do vínculo `investimento_id` em `PluggyInvestment`.
- Plano de execução completo (decisões técnicas, arquivos críticos): plano de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-nova-sprint-para-foamy-falcon.md` — a sessão de
  execução deve ler este PRD + o plano de sprint associado; não é necessário reler o plano de
  sessão bruto.
