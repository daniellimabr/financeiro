# PRD-033: Auditoria do Saldo Acumulado — agosto (mês corrente) e continuidade abril-julho

- **Status:** concluído
- **Épico relacionado:** nenhum (auditoria manual do CEO, sem sessão de planejamento prévia)
- **Sprint(s):** [SPRINT-033-auditoria-saldo-acumulado-abril-agosto-plan.md](../sprints/SPRINT-033-auditoria-saldo-acumulado-abril-agosto-plan.md)

## Problema

Continuação da auditoria mês a mês do card "Saldo Acumulado" (iniciada na Sprint 32, que fechou
jan-mar/2026). Nesta sessão o CEO auditou agosto/2026 (mês corrente) contra o saldo real dos 3
bancos, pediu uma checagem de continuidade de abril a julho, e trouxe o extrato real do Itaú
(jan-jun/2026) para bater linha a linha. Documentado retroativamente — sem sessão de `/plan`
prévia, mesmo padrão retroativo das Sprints 30/31/32.

**Sem nenhuma mudança de código nesta sprint.** As 3 investigações usaram scripts Python
read-only (`docker compose exec -T api python -`, lendo `app.dashboards.service` diretamente
contra o Postgres real da VM de dev) para achar as causas de divergência; todas as correções
foram dados de configuração que o próprio CEO aplicou pela tela Configurações — não código.

## Investigação 1 — Agosto (mês corrente): card mostrava R$3.574,69, CEO somou R$3.419,21 nos bancos

Decompus a diferença (~R$155) em duas causas sobrepostas, comparando
`get_saldo_acumulado_conferencia` contra `PluggyAccount.saldo` (saldo Pluggy ao vivo) e
`PluggyItem.last_synced_at`:

- **R$88,04 era timing**: o CEO conferiu o extrato real depois do último sync (14:41 BRT) —
  dinheiro se moveu na conta depois da última sincronização, ainda não capturado.
- **R$67,44 era `saldo_inicial` descalibrado** em 2 das 3 contas: XP tinha R$535,55 (deveria ser
  R$421,54 — mesmo valor já calculado na investigação original do PRD-032, nunca aplicado) e
  NuBank tinha R$0,30 (deveria ser R$46,51 — achado novo desta sessão).

**Ação do CEO:** rodou um sync novo e corrigiu `saldo_inicial` da XP e do NuBank pela tela
Configurações. Revalidação pós-correção: NuBank e XP bateram **exatos** (R$0,00 de diferença)
contra o saldo Pluggy ao vivo; sobrou só R$0,37 no Itaú (mesmo resíduo pré-existente, não
introduzido pelas correções — explicado na Investigação 3).

## Investigação 2 — Continuidade abril-julho/2026

Checagem de continuidade (saldo_fim de um mês = saldo_início do mês seguinte, por conta) — bateu
certo nas 3 contas, sem gap, do início ao fim.

**Achado: abril reproduzia o problema já sinalizado (não resolvido) desde a Sprint 32.** Itaú
tinha `saldo_efetivo` negativo (−R$10.224,69) porque duas transações "Salário" no mesmo fim de
semana (bônus R$11.118,85 + salário normal R$9.925,60, ambas com `data_competencia` = maio) eram
subtraídas do saldo do Itaú — mas o bônus já tinha **saído** da conta (Pix de R$11.000 pro NuBank,
no mesmo dia) antes do fim do mês. A regra de "salário antecipado" assume que o dinheiro ainda
está fisicamente na conta esperando o mês seguinte; como não estava mais (o Pix já reduzia o saldo
normalmente), a subtração dupla criava um saldo efetivo artificialmente negativo.

**Fato trazido pelo CEO:** o bônus foi pago em abril, transferido pro NuBank, e virou os gastos de
viagem de maio — compra de euros/francos numa conta Global do NuBank (conectada ao Wise, que o
projeto não vai integrar). Bate exatamente com o extrato: NuBank tem R$12.541,34 de despesa em
maio sem receita correspondente naquele mês.

**Decisão do CEO** (via `AskUserQuestion`, 3 opções apresentadas: limitar a subtração ao saldo
restante / não mexer na regra / reclassificar o bônus): reclassificar o bônus pra fora da
subcategoria "Salário" (foi para "Receita/Outros"), em vez de mudar a fórmula. Revalidação:
abril saudável (Itaú R$894,16, total R$16.623,31).

**Achado secundário, não resolvido:** XP parada em R$992,11 de maio a agosto (zero
receitas/despesas nos 4 meses) — pode ser real (conta sem movimento) ou gap de sync específico
dessa conta; pendente de confirmação do CEO.

## Investigação 3 — Extrato real do Itaú (jan-jun/2026, PDF fornecido pelo CEO)

Comparando o saldo de fim de mês do extrato real contra o `saldo_fim` calculado pelo sistema,
achei um desvio constante de **exatamente R$0,30** (sistema sempre R$0,30 abaixo do real) em
**todos os 6 meses** cobertos pelo extrato (jan-jun/2026) — rastreado até o `saldo_inicial` do
Itaú: R$16.037,27 configurado vs. R$16.037,57 real (saldo de 31/12/2025 no extrato). Fora esse
offset constante, toda a movimentação sincronizada do Itaú bateu exata contra o extrato — nenhuma
transação faltando, duplicada ou mal somada.

**Nota:** esse mesmo desvio de R$0,30 explica o resíduo de R$0,37 observado na Investigação 1 —
não era ruído/arredondamento aleatório. Também explica por que a Sprint 32 achou "bate exato" em
fev/mar usando Itaú+NuBank: o `saldo_inicial` do NuBank estava errado na direção oposta e
cancelava, por coincidência, o desvio do Itaú no total combinado — cancelamento que desapareceu
assim que o NuBank foi corrigido na Investigação 1.

**Ação do CEO:** corrigiu `saldo_inicial` do Itaú de R$16.037,27 para R$16.037,57 pela tela
Configurações.

## Escopo

### Incluído

- 3 scripts de investigação read-only (Python, via `docker compose exec -T api python -`)
  chamando `get_saldo_acumulado`/`get_saldo_acumulado_conferencia` contra o Postgres real —
  nenhum grava dado, todos só leem e comparam.
- Correções de dado feitas pelo CEO pela tela Configurações (não código): `saldo_inicial` de XP,
  NuBank e Itaú; recategorização do bônus de abril; um sync Pluggy manual.

### Fora de escopo (explicitamente)

- Mudança na regra de "salário antecipado" (`_salario_antecipado_por_conta_e_mes`) — decisão do
  CEO foi reclassificar o dado (bônus), não mudar a fórmula.
- Fechar a validação completa de abril-julho para NuBank/XP — o extrato trazido cobriu só o Itaú;
  falta o extrato real de NuBank/XP desses meses para reconciliar por completo.
- Investigar a flatline da XP (maio-agosto) a fundo — sinalizado, não resolvido.
- As 8 transações históricas de Aporte/Resgate mal categorizadas (pendência já registrada desde a
  Sprint 32, segue em aberto).

## Critérios de aceite

1. Agosto: `get_saldo_acumulado_conferencia` para NuBank e XP bate exato (R$0,00 de diferença)
   contra `PluggyAccount.saldo` pós-correção. **Atendido.**
2. Abril: `saldo_efetivo` do Itaú deixa de ser negativo após a reclassificação do bônus.
   **Atendido** (R$894,16).
3. Continuidade abril-julho (saldo_fim mês N = saldo_início mês N+1, por conta) sem gap.
   **Atendido.**
4. Itaú jan-jun/2026: `saldo_fim` calculado bate exato contra o extrato real após a correção do
   `saldo_inicial`. **Atendido** (desvio de R$0,30 eliminado nos 6 meses).

## Segurança

Nenhum dado sensível novo, nenhum secret. Todos os scripts de investigação foram read-only
(nenhum `commit()`/`UPDATE` — só `db.query(...)`). Nenhuma mudança de isolamento por usuário.

## Referências

- [PRD-032](PRD-032-saldo-acumulado-saldo-real-e-conferencia-por-conta.md) — origem da fórmula e
  do achado pendente do `saldo_inicial` da XP, fechado nesta sprint.
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) — procedimento de SSH usado nos 3 scripts
  de investigação.
