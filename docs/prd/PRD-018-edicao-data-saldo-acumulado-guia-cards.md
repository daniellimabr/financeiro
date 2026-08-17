# PRD-018: Edição Manual de Data + Investigação de Saldo Acumulado + Guia dos Cards

- **Status:** aprovado
- **Épico relacionado:** nenhum (sem épico prévio no roadmap — item trazido
  diretamente pelo CEO nesta sessão de planejamento, 2026-08-17)
- **Sprint(s):** [SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md](../sprints/SPRINT-018-edicao-data-saldo-acumulado-guia-cards-plan.md)

## Problema

Três pedidos do CEO conectados por um mesmo fio condutor: confiança na
conferência do saldo mensal do sistema contra o extrato bancário real (o
mesmo objetivo que motivou a reconciliação da Sprint 17).

1. **Editar data do evento manualmente.** A Sprint 16 já investigou o "lag de
   fim de semana" (transações de sábado/domingo que o banco só lança no
   próximo dia útil) e decidiu, deliberadamente, não corrigi-lo com uma
   heurística automática (sem campo de liquidação no payload da Pluggy,
   risco de acertar errado sem tratar feriados) — registrado em
   `docs/roadmap.md` como candidato a revisão futura. A Sprint 17 confirmou
   esse mesmo lag como causa das únicas diferenças reais encontradas na
   reconciliação de janeiro/fevereiro (R$395,42 e R$159,68, ambas rastreadas
   transação a transação). Este pedido é a alternativa a uma heurística
   automática: dar ao usuário uma correção manual, pontual, para os casos em
   que ele mesmo perceber o desvio.
2. **Revisar a fórmula do "saldo do mês".** Investigação de código nesta
   sessão de planejamento confirmou que `get_summary` (card "Saldo" =
   receita − despesa do período) já exclui fatura prevista e limite de
   cartão — não há bug de fórmula ali. Ao perguntar ao CEO onde exatamente
   ele via o problema, ele apontou o card **"Saldo Acumulado"**, que não
   reflete corretamente a soma Itaú + NuBank em 31/01/2026 — métrica
   diferente (`get_saldo_acumulado`, ledger por competência/caixa ancorado
   em `saldo_inicial`), não a fórmula originalmente suspeitada. Por isso
   este bloco começa como investigação com dado real, não como uma correção
   pré-definida.
3. **Explicação simplificada dos cards.** Pedido direto do CEO,
   complementar aos dois primeiros: um guia não técnico do que entra/não
   entra em cada card do Dashboard, incluindo o efeito do toggle
   Competência/Caixa.

Confirmado com o CEO nesta sessão: a edição de data fica na tela
Categorização (mesmo padrão de célula editável já usado para descrição) e
deve sobreviver a resyncs futuros da Pluggy — sem isso a feature não serve
ao objetivo de conferência permanente. Sobre o Saldo Acumulado, o CEO
esclareceu que a conta de cartão de crédito não deveria mesmo ter
`saldo_inicial` ("ela é usada somente para obter as operações feitas via
cartão") — o que torna mais provável que a divergência percebida seja
conceitual (competência/caixa tem defasagem de 1-2 meses para cartão; um
snapshot bancário real não tem), não um bug de fórmula. Só será confirmado
com dado real na execução.

## Escopo

- Incluído:
  - Edição manual de `data` de uma transação `pluggy_transactions` na tela
    Categorizar (célula inline, mesmo padrão de `DescriptionCell`), com
    recompute de `data_competencia`/`data_caixa` a partir da nova data e
    trava contra sobrescrita em resyncs futuros da Pluggy.
  - Investigação da divergência do card "Saldo Acumulado" (Itaú + NuBank,
    31/01/2026) com dado real da VM de dev + extrato do Itaú já disponível
    — escopo de correção decidido só após o achado (bug real vs. diferença
    conceitual esperada entre competência/caixa e snapshot bancário).
  - Guia não técnico (`docs/dashboards-guia-cards.md`) explicando o que
    entra/não entra em cada card do Dashboard e o efeito do toggle
    Competência/Caixa.
- Fora de escopo (explicitamente):
  - Edição de data nas tabelas de drill-down do Dashboard (`TransactionsTable`)
    — só a tela Categorizar, confirmado com o CEO.
  - Botão de "desfazer" uma edição de data (voltar a sincronizar
    automaticamente da Pluggy) — se o usuário errar, edita de novo
    manualmente.
  - Validação de data contra o corte de dados (2026-01-01) ou contra uma
    janela — só bloqueia data futura.
  - Mudar a fórmula de `get_summary` (já confirmada correta nesta sessão).
  - Qualquer correção de "Saldo Acumulado" além do que a investigação do
    Bloco 2 confirmar como necessário — não pré-especificável.

## Critérios de aceite

1. Dado o usuário na tela Categorizar, quando edita a data de uma
   transação para um valor não futuro, então `data` é atualizada,
   `data_competencia`/`data_caixa` são recalculadas a partir da nova data
   (respeitando as regras de cartão de crédito e Salário já existentes), e
   a mudança é refletida nos dashboards (invalidação de cache).
2. Dado uma transação com data editada manualmente, quando um resync da
   Pluggy roda novamente para a mesma transação, então `data`,
   `data_competencia` e `data_caixa` permanecem com o valor editado, não o
   valor bruto vindo da API.
3. Dado uma transação **não** editada manualmente, quando um resync roda,
   então o comportamento de hoje é preservado sem regressão (data e
   competência continuam sendo atualizadas a partir do valor da Pluggy).
4. Dado o card "Saldo Acumulado" investigado com dado real (Itaú + NuBank,
   31/01/2026), quando a causa da divergência é confirmada, então: se for
   bug real, a correção é implementada com teste de regressão e revalidada;
   se for diferença conceitual esperada (competência/caixa vs. snapshot
   bancário), a UI passa a deixar essa diferença clara (rótulo/nota),
   documentado no relatório de sprint com os números reais comparados.
5. Dado o guia `docs/dashboards-guia-cards.md`, quando lido por alguém sem
   contexto técnico, então cada card do Dashboard (Saldo, Saldo Acumulado,
   Saldo Anterior, Receita, Despesa, Ativos, Passivos, Patrimônio, e o
   drill-down "Saldo por conta") tem uma explicação simples do que
   entra/não entra na conta e como o toggle Competência/Caixa o afeta.

## Regras de negócio

- **Edição manual de data é uma trava explícita, não implícita** — uma
  coluna dedicada (`data_editada_manualmente`), não reaproveita
  `categorizacao_status`, para não travar `data` de toda transação
  confirmada (evento muito mais frequente que uma edição de data
  deliberada).
- **Recompute de competência/caixa segue as mesmas regras já existentes**
  (`competencia_padrao`/`caixa`/`competencia_salario` em
  `app/categorization/competencia.py`) — a edição manual não cria uma
  regra de competência nova, só dispara o recompute já usado por
  `set_category`/`bulk_confirm` a partir do novo valor de `data`.
- **Toda correção de gap no Bloco 2 passa por investigação de causa raiz
  antes de qualquer mudança de código** — mesmo padrão das Sprints
  10/15/16/17: nunca corrigir às cegas, confirmar contra dado real, e
  voltar ao CEO quando a causa tocar uma regra de negócio já decidida.

## Dados e modelo

- Migration nova: `pluggy_transactions.data_editada_manualmente`
  (`Boolean`, `not null`, `default False`) — sem backfill necessário.
- Nenhuma migration prevista para o Bloco 2 a menos que a investigação
  confirme um bug real que exija mudança de schema (não previsível de
  antemão).
- Nenhuma migration para o Bloco 3 (documentação pura).

## Segurança

- Isolamento por usuário preservado: o novo endpoint de edição de data usa
  `_get_transaction(db, user_id, transaction_id)`, mesmo padrão de
  `update_description`/`set_category` — 404 para transação de outro
  usuário.
- Nenhuma credencial nova envolvida.

## Fora de escopo / decisões adiadas

- Desfazer edição manual de data (candidata a revisão futura se o CEO
  precisar).
- Toggle Competência/Caixa aplicado ao guia de cards em si — o guia
  documenta o comportamento existente, não adiciona toggle novo em
  nenhuma tela.
- Heurística automática de lag de dia útil Pluggy vs. extrato bancário —
  decisão já fechada na Sprint 16; a edição manual desta sprint é
  explicitamente a alternativa a essa heurística, não uma reabertura da
  decisão.

## Referências

- [docs/roadmap.md](../roadmap.md) — Sprint 16 (lag de fim de semana,
  decisão de não implementar heurística automática) e Sprint 17
  (reconciliação, origem do extrato do Itaú e dos números de 31/01/2026).
- [PRD-015-configuracoes-competencia-salario-saldo-acumulado.md](PRD-015-configuracoes-competencia-salario-saldo-acumulado.md)
  — origem de `saldo_inicial`/`get_evolucao_saldo_por_conta`.
- [PRD-016-regime-competencia-caixa-patrimonio.md](PRD-016-regime-competencia-caixa-patrimonio.md)
  — origem de `data_competencia`/`data_caixa`/`get_saldo_acumulado`.
- [SPRINT-017-filtro-conta-validacao-extrato-report.md](../sprints/SPRINT-017-filtro-conta-validacao-extrato-report.md)
  — saldo real do Itaú em 31/01/2026 (R$ 10.913,75) e metodologia de
  reconciliação reaproveitada no Bloco 2 desta sprint.
- Extrato do Itaú (PDF, 1º semestre de 2026, `F:\financeiro\itau_extrato_012026.pdf`)
  — fonte externa já usada na Sprint 17, não versionada no repo.
- Plano de execução completo (decisões técnicas, arquivos críticos): plano
  de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-uma-sprint-para-greedy-matsumoto.md`
  — a sessão de execução deve ler este PRD + o plano de sprint associado;
  não é necessário reler o plano de sessão bruto.
