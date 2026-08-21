# SPRINT-033: Auditoria do Saldo Acumulado — agosto (mês corrente) e continuidade abril-julho — Plano

- **PRD(s):** [PRD-033-auditoria-saldo-acumulado-abril-agosto.md](../prd/PRD-033-auditoria-saldo-acumulado-abril-agosto.md)
- **Data do plano:** 2026-08-21

**Nota:** plano escrito retroativamente, na mesma sessão de execução — o CEO retomou a auditoria
mês a mês do Saldo Acumulado (sem sessão de `/plan` prévia), as 3 investigações e as decisões de
como tratar cada divergência achada foram resolvidas ao vivo (via `AskUserQuestion` no caso do
bônus de abril), e só depois de tudo revalidado é que este plano e o PRD foram escritos,
documentando o que de fato aconteceu — mesmo padrão retroativo das Sprints 30/31/32.

## Objetivo da sprint

Fechar a validação de agosto/2026 (mês corrente) e abril-julho/2026 contra dado real (saldo
Pluggy ao vivo + extrato bancário do Itaú), achando e corrigindo qualquer causa raiz de
divergência — sem tocar em código, já que a fórmula do Saldo Acumulado (Sprint 32) segue correta;
o que faltava era a calibração dos dados de configuração (`saldo_inicial` por conta) e uma
categorização.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Investigar divergência de agosto (R$3.574,69 do card vs. R$3.419,21 somado pelo CEO nos 3 bancos): script Python read-only comparando `get_saldo_acumulado_conferencia` contra `PluggyAccount.saldo` e `PluggyItem.last_synced_at` | Sonnet: investigação (SSH VM dev) | `backend/app/dashboards/service.py`, `backend/app/models/pluggy.py` |
| 2 | Apresentar o achado (timing de sync + `saldo_inicial` descalibrado em XP/NuBank) e aguardar o CEO rodar sync + corrigir os 2 valores pela UI | Sonnet: investigação | `docs/infra/ssh-workflow.md` |
| 3 | Revalidar agosto pós-correção (mesmo script) | Sonnet: investigação (SSH VM dev) | — |
| 4 | Checar continuidade abril-julho/2026 (saldo_fim mês N = saldo_início mês N+1, por conta) e olhar `get_saldo_acumulado_conferencia` de cada mês em busca de anomalias | Sonnet: investigação (SSH VM dev) | `backend/app/dashboards/service.py` |
| 5 | Investigar o achado de abril (Itaú com `saldo_efetivo` negativo) — explicar o mecanismo (dupla subtração: Pix real + subtração de "salário antecipado" sobre a mesma transação) | Sonnet: investigação | — |
| 6 | Decidir com o CEO (via `AskUserQuestion`, 3 opções) como tratar o caso — CEO escolheu reclassificar o bônus fora de "Salário" pela UI, em vez de mudar a fórmula | Sonnet: investigação | — |
| 7 | Revalidar abril pós-reclassificação (mesmo script) | Sonnet: investigação (SSH VM dev) | — |
| 8 | Ler o extrato real do Itaú (PDF fornecido pelo CEO, jan-jun/2026) e comparar saldo de fim de mês contra `saldo_fim` calculado, mês a mês | Sonnet: investigação | `itau_extrato_012026.pdf` (fornecido pelo CEO) |
| 9 | Identificar a causa raiz do desvio constante (R$0,30, todos os 6 meses) — `saldo_inicial` do Itaú | Sonnet: investigação | — |
| 10 | CEO corrige `saldo_inicial` do Itaú pela tela Configurações | CEO (fora do código) | — |
| 11 | Documentação retroativa: este PRD/plano/relatório + entrada no `docs/roadmap.md` (incl. contador da cadência de auditoria estrutural) + atualização da memória de auditoria do projeto | Sonnet: implementação | `docs/roadmap.md` |

## Coerência de Design (DESIGN.md)

Omitida — sprint 100% investigação de dado real via script read-only na VM de dev; nenhuma tela,
componente ou endpoint novo/alterado.

## Testes previstos

Nenhum — sem código tocado. As 3 investigações usaram apenas scripts read-only (`db.query(...)`,
sem `commit()`/`UPDATE`) contra o Postgres real da VM de dev, e as correções foram aplicadas pelo
próprio CEO via UI (dado de configuração, não código).

## Impacto no roadmap

Cross-epic, sem épico prévio — continuação direta da auditoria aberta na Sprint 32. Conta para a
cadência de auditoria estrutural (nenhuma linha de código mudou, mas é uma sprint executada e
aprovada, mesmo critério já usado nas Sprints 30/31/32).

## Riscos / dependências

- Nenhuma migration, nenhum deploy — as correções são dados de configuração (`saldo_inicial` por
  conta, subcategoria de uma transação), gravados pelo próprio CEO pela UI já existente
  (`ConfiguracoesPage`/`CategorizationReviewPage`), não por comando SSH desta sessão.
- Scripts de investigação passaram por `docker compose exec -T api python -` (stdin, base64) para
  evitar problemas de quoting entre PowerShell → paramiko → bash → docker exec — nenhum grava
  dado, mitigando o risco de rodar comando arbitrário contra o Postgres real da VM de dev.
