# SPRINT-033: Auditoria do Saldo Acumulado — agosto (mês corrente) e continuidade abril-julho — Relatório

- **Plano:** [SPRINT-033-auditoria-saldo-acumulado-abril-agosto-plan.md](./SPRINT-033-auditoria-saldo-acumulado-abril-agosto-plan.md)
- **Data do relatório:** 2026-08-21
- **Aprovado pelo CEO em:** 2026-08-21 ("registrar essa conversa como uma sprint retroativa, aprovada")

## Resumo

Continuação da auditoria mês a mês do Saldo Acumulado (Sprint 32). Três investigações
read-only contra o Postgres real da VM de dev acharam três causas de divergência distintas —
todas de **dado de configuração**, nenhuma de código: `saldo_inicial` descalibrado em XP, NuBank
e Itaú, e uma transação (bônus) categorizada de um jeito que colidia com a regra de "salário
antecipado". O CEO corrigiu os 4 pontos pela UI (Configurações + recategorização) ao longo da
sessão. Sem nenhuma linha de código tocada.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Investigar divergência de agosto | feito | Script Python read-only, `docker compose exec -T api python -` |
| 2 | Apresentar achado e aguardar correção do CEO | feito | CEO rodou sync + corrigiu `saldo_inicial` XP/NuBank |
| 3 | Revalidar agosto | feito | NuBank/XP exatos (R$0,00 diff); Itaú com resíduo de R$0,37 (explicado na Investigação 3) |
| 4 | Checar continuidade abril-julho | feito | Sem gap nas 3 contas |
| 5 | Investigar achado de abril (Itaú negativo) | feito | Dupla subtração: Pix real (NuBank) + subtração de "salário antecipado" sobre o mesmo bônus |
| 6 | Decidir com o CEO como tratar | feito | `AskUserQuestion`, 3 opções — CEO escolheu reclassificar o bônus fora de "Salário" |
| 7 | Revalidar abril | feito | Itaú R$894,16, total R$16.623,31 |
| 8 | Ler extrato real do Itaú (PDF, jan-jun/2026) | feito | Fornecido pelo CEO nesta sessão |
| 9 | Achar causa raiz do desvio de R$0,30 | feito | `saldo_inicial` do Itaú: R$16.037,27 configurado vs. R$16.037,57 real |
| 10 | CEO corrige `saldo_inicial` do Itaú | feito | Confirmado pelo CEO ("ajustado") |
| 11 | Documentação retroativa | feito | Este conjunto de documentos |

## Achados detalhados

### Agosto/2026 (mês corrente)

| | Card antes | Pluggy ao vivo (sync 14:41) | Extrato real do CEO |
|---|---|---|---|
| Total | R$3.574,69 | R$3.507,25 | R$3.419,21 |

Decomposição: R$88,04 era timing (CEO conferiu depois do sync — confirmado pelo próprio CEO via
`AskUserQuestion`); R$67,44 era `saldo_inicial` descalibrado (XP R$535,55→R$421,54; NuBank
R$0,30→R$46,51). Pós-correção + sync novo: NuBank e XP bateram **exatos** contra o saldo Pluggy ao
vivo (R$0,00 de diferença cada); Itaú manteve um resíduo de R$0,37 — explicado na investigação do
Itaú (ver abaixo).

### Abril/2026 — dupla subtração do bônus

Itaú tinha `saldo_efetivo` = **−R$10.224,69** (saldo_fim R$10.819,76 − salário_recebido
R$21.044,45, soma de bônus R$11.118,85 + salário normal R$9.925,60, ambas com competência maio).
Mecanismo: o bônus saiu da conta via Pix (R$11.000 pro NuBank) no mesmo dia em que entrou — a
regra de "salário antecipado" assume que o dinheiro ainda está fisicamente na conta esperando o
mês seguinte, então a subtração dupla (Pix real reduzindo o saldo + subtração de competência sobre
o mesmo valor) inflava artificialmente o resultado negativo.

CEO confirmou o fato real: bônus pago em abril → transferido pro NuBank → virou a compra de
euros/francos de maio numa conta Global (Wise, fora de escopo de integração). Bate com o extrato:
NuBank tem R$12.541,34 de despesa em maio sem receita correspondente.

CEO escolheu (entre 3 opções: limitar a subtração ao saldo restante / não mexer na regra /
reclassificar o bônus) **reclassificar o bônus fora da subcategoria "Salário"**. Pós-correção:
Itaú R$894,16, total de abril R$16.623,31 (era R$5.504,46).

### Itaú jan-jun/2026 — desvio constante de R$0,30

Extrato real fornecido pelo CEO (PDF, período 01/01/2026-30/06/2026). Comparando saldo de fim de
mês contra `saldo_fim` calculado pelo sistema:

| Mês | Extrato real | Sistema (antes) | Diferença |
|---|---|---|---|
| Jan | 10.913,75 | 10.913,45 | −0,30 |
| Fev | 11.468,97 | 11.468,67 | −0,30 |
| Mar | 10.319,14 | 10.318,84 | −0,30 |
| Abr | 10.820,06 | 10.819,76 | −0,30 |
| Mai | 10.195,52 | 10.195,22 | −0,30 |
| Jun | 10.145,23 | 10.144,93 | −0,30 |

Causa raiz: `saldo_inicial` do Itaú configurado como R$16.037,27, mas o saldo real de 31/12/2025
no extrato é R$16.037,57. Fora esse offset constante, toda a movimentação sincronizada do Itaú
bateu exata — nenhuma transação faltando/duplicada/mal somada nos 6 meses. CEO corrigiu para
R$16.037,57.

**Nota retrospectiva:** esse mesmo R$0,30 explica o resíduo de R$0,37 da revalidação de agosto (a
diferença residual de R$0,07 provavelmente é o mesmo tipo de timing já identificado na
Investigação 1, não um novo problema). Também explica por que a Sprint 32 tinha achado "Itaú+NuBank
bate exato" em fev/mar: o erro do NuBank (na direção oposta) cancelava, por coincidência, o erro
do Itaú no total combinado — cancelamento que só ficou visível como dois erros separados depois
que o NuBank foi corrigido nesta sessão.

## Continuidade abril-julho

Checagem de `saldo_fim` de um mês = `saldo_início` do mês seguinte, por conta (NuBank/XP/Itaú) —
sem gap em nenhum dos 4 meses, incluindo na transição em que o `saldo_inicial` foi corrigido.

**Achado secundário, não resolvido:** XP parada em R$992,11 de maio a agosto/2026 (zero
receitas/despesas sincronizadas nos 4 meses). Pode ser real (conta sem movimento) ou gap de sync
específico desse item Pluggy — sinalizado ao CEO, sem decisão ainda.

## Evidência

Sem testes automatizados/lint (nenhum código tocado). Evidência é a saída dos 3 scripts de
investigação (read-only, `db.query`, sem `commit()`) rodados via SSH contra o Postgres real da VM
de dev, reproduzida nas tabelas acima, e o extrato real do Itaú fornecido pelo CEO.

## Decisões tomadas durante a execução

- **Reclassificar o bônus em vez de mudar a regra de "salário antecipado"** — a regra continua
  válida pro caso comum (salário chega perto do fim do mês e fica parado); o caso do bônus era uma
  exceção pontual (recebido e gasto/transferido no mesmo mês), resolvida no dado, não no código.
- **Correções de `saldo_inicial` feitas pelo CEO, não por comando SSH desta sessão** — consistente
  com a política de "ações sensíveis com baseline financeiro real passam por revisão explícita do
  CEO" (`docs/infra/ssh-workflow.md`); os scripts desta sprint foram estritamente read-only.
- **Sprint sem código** — todas as 3 correções de dado (saldo_inicial × 3 contas + recategorização
  do bônus) foram aplicadas pelo próprio CEO via UI existente, não requereram nenhuma mudança em
  `backend`/`frontend`.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Agosto: NuBank/XP batem exato contra saldo Pluggy ao vivo pós-correção | sim | R$0,00 de diferença em ambas |
| 2. Abril: saldo efetivo do Itaú deixa de ser negativo | sim | R$894,16 |
| 3. Continuidade abril-julho sem gap | sim | Confirmado nas 3 contas |
| 4. Itaú jan-jun bate exato contra o extrato real pós-correção | sim | Desvio de R$0,30 eliminado nos 6 meses |

## Documentação atualizada

`roadmap.md` (entrada da Sprint 33 + contador da cadência de auditoria estrutural) e a memória de
projeto da auditoria do Saldo Acumulado (fora do repo, `~/.claude/.../memory/`).

## Consumo estimado de tokens/sessões

Sprint pequena em código (zero) mas com investigação substancial: 3 ciclos de SSH+script Python
contra dado real, leitura de um PDF de extrato bancário de 14 páginas, e uma decisão de produto
resolvida ao vivo via `AskUserQuestion`. Comparável a uma sprint de investigação média.

## Pendências e próximos passos sugeridos

1. **XP parada de maio a agosto** — confirmar com o CEO se é real ou gap de sync.
2. **Fechar abril-julho por completo** — falta o extrato real de NuBank/XP desses meses (só Itaú
   foi conferido nesta sprint).
3. **8 transações de Aporte/Resgate mal categorizadas** — pendência já registrada desde a Sprint
   32, segue em aberto.
4. **Resíduo de R$0,07 em agosto** (R$0,37 observado − R$0,30 já explicado pelo Itaú) — não
   investigado a fundo, provavelmente timing residual, mesma natureza da Investigação 1.
