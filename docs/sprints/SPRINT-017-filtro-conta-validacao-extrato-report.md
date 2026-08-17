# SPRINT-017: Filtro de Conta em Categorizar + Validação de Dados/Cálculos contra Extrato Real — Relatório

- **Plano:** [SPRINT-017-filtro-conta-validacao-extrato-plan.md](./SPRINT-017-filtro-conta-validacao-extrato-plan.md)
- **Data do relatório:** 2026-08-17

## Resumo

Bloco 1 (filtro de conta em Categorizar) implementado, testado, deployado na
VM de dev e validado ao vivo contra dado real. Bloco 2 (reconciliação
jan–jun/2026 contra o extrato real do Itaú) concluído: **nenhum bug de
data/cálculo encontrado** — março a junho batem exatos ao centavo, janeiro e
fevereiro têm diferença 100% explicada pelo lag de liquidação de fim de
semana já documentado e decidido como fora de escopo na Sprint 16. A própria
reconciliação revelou um achado real, mas de produto: transferências para
investimento não têm categoria própria (uma delas, miscategorizada como
"Impostos e taxas", ainda infla a despesa de janeiro) — vira pauta de uma
sprint nova, não tratada aqui por decisão do CEO.

## Itens do plano vs. entregue

| # | Tarefa | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | `account_id` em `GET /categorization/transactions` | feito | Sem desvio |
| 2 | `list_transactions()` com filtro `account_id` | feito | Sem desvio |
| 3 | `TransactionsFilter`/`fetchTransactions` com `accountId` | feito | Sem desvio |
| 4 | `useCategorizationTransactions` com `accountId` na query key | feito | Sem desvio |
| 5 | `<select>` de conta em `CategorizationReviewPage.tsx` | feito | Sem desvio |
| 6 | Testes backend (isolado, combinado, isolamento cross-user) | feito | Sem desvio |
| 7 | Testes frontend (select popula contas, muda filtro, reflete `account_id`) | feito | Sem desvio |
| 8 | `check-categorizacao.mjs` estendido | feito | Sem desvio |
| 9 | Deploy VM de dev | feito | Sem desvio |
| 10 | Reconciliação mês a mês (jan→jun/2026) | feito | Nenhum gap real de dado/cálculo encontrado — ver "Reconciliação" abaixo. Achado real foi de produto (categoria de investimento ausente), registrado para sprint nova em vez de corrigido aqui, por decisão explícita do CEO |
| 11 | Docs vivos (`OVERVIEW.md`, `roadmap.md`) | feito | `directory-structure.md` não precisou de mudança — nenhum arquivo/diretório novo nesta sprint |
| 12 | Relatório de sprint | feito | Este documento |

## Evidência de testes

### Backend

```
425 passed, 452 warnings in 7.66s
TOTAL                                 1867     38    98%
app\categorization\service.py          194      2    99%
```

### Frontend

```
Test Files  24 passed (24)
     Tests  163 passed (163)
```

### Lint/formatter

```
backend: ruff check . / ruff format --check . — All checks passed! / 91 files already formatted
frontend: eslint . — sem erros
frontend: tsc --noEmit — sem erros
frontend: prettier --check . — All matched files use Prettier code style!
```

## Reconciliação jan–jun/2026 — metodologia e resultado

Fonte: extrato do Itaú (PDF, período 01/01/2026–30/06/2026, fornecido pelo
CEO nesta sessão — não versionado no repo, `.gitignore` atualizado
(`itau_extrato_*.pdf`) antes de qualquer leitura do arquivo).

**Saldo por mês** — comparado `get_evolucao_saldo_por_conta` (conta "Itaú -
Conta Corrente", `account_id=4`, `saldo_inicial=16.037,57`, que já batia
exatamente com o "SALDO DO DIA" de 31/12/2025 do extrato) contra o último
"SALDO DO DIA" de cada mês no extrato:

| Mês | Extrato (R$) | Sistema (R$) | Diferença | Causa |
|---|---|---|---|---|
| Janeiro | 10.913,75 | 10.518,33 | 395,42 | Lag de fim de semana (5 lançamentos de 31/01, sábado, só lançados pelo Itaú em 02/02) |
| Fevereiro | 11.468,97 | 11.309,29 | 159,68 | Lag de fim de semana (1 lançamento de 28/02, sábado, só lançado pelo Itaú em 02/03) |
| Março | 10.319,14 | 10.319,14 | 0,00 | — |
| Abril | 10.820,06 | 10.820,06 | 0,00 | — |
| Maio | 10.195,52 | 10.195,52 | 0,00 | — |
| Junho | 10.145,23 | 10.145,23 | 0,00 | — |

As duas diferenças foram confirmadas transação a transação, não só por
coincidência de soma: as 5 transações do sistema datadas `2026-01-31`
(`Ronaldo -8,50`, `REDE RIO -330,95`, `NOVO MERCADO -4,00`, `BELL ART
-35,97`, `ShoppingPlaza -16,00`, soma exata -395,42) batem descrição e valor
com as linhas do extrato sufixadas "3101" lançadas em 02/02/2026; a transação
de `2026-02-28` (`PIX Marketplace -159,68`) bate com a linha "PIX QRS PIX
Marketp28/02 -159,68" lançada em 02/03/2026. Esse lag é o mesmo padrão já
investigado e deliberadamente não corrigido na Sprint 16 (heurística de dia
útil, sem campo de liquidação no payload da Pluggy) — critério de aceite 3 do
PRD-017 aceita explicitamente "desvio documentado e já conhecido".

**Linha a linha (janeiro completo)** — as 78 transações da conta em janeiro
foram conferidas uma a uma contra o extrato (data, descrição, valor): 100%
com correspondência exata, incluindo todas as datas deslocadas por fim de
semana. Fevereiro a junho não tiveram a mesma transcrição manual linha a
linha — a validação foi por saldo agregado batendo ao centavo (4 dos 6 meses
exatos, os outros 2 com toda a diferença explicada por uma única transação
verificada cada) — decisão de escopo, ver "Pendências".

**Categorização** — zero transações pendentes na conta "Itaú - Conta
Corrente" nos 6 meses (todas já confirmadas em sprints anteriores).

## Achado de produto: transferências para investimento sem categoria própria

Ao revisar o resultado da reconciliação, o CEO identificou que a despesa
total de janeiro parecia alta e apontou a causa: um PIX de R$5.000,00 em
03/01/2026 ("Pix enviado Daniel Ismerio de Oliveira Lima"), que é uma
transferência em cadeia Itaú Corrente → NuBank Corrente → Investimento
NuBank, está categorizado como **"Impostos e taxas"** — miscategorização
real que infla a despesa de janeiro. Não existe hoje uma categoria de
"Investimento/Aporte" (despesa) nem "Investimento/Resgate" (receita) para
rastrear esse fluxo; a conta de investimento NuBank também não está
conectada via Pluggy. Varredura rápida de transações "Pix ... Daniel Ismerio
de Oliveira Lima" nos 6 meses (mesmo padrão de autotransferência) encontrou
mais 4 ocorrências, já categorizadas como "Transferência interna" (correto
para excluir de totais, mas não específico o suficiente para rastrear
aporte/resgate):

| Data | Valor (R$) | Categoria atual |
|---|---|---|
| 2026-01-03 | -5.000,00 | Impostos e taxas (errado) |
| 2026-03-27 | +500,00 | Transferência interna |
| 2026-04-29 | -11.000,00 | Transferência interna |
| 2026-04-30 | -3.000,00 | Transferência interna |
| 2026-06-30 | -3.000,00 | Transferência interna |

**Nenhuma correção foi aplicada nesta sprint** — por decisão explícita do
CEO, o desenho da categorização/tela de investimentos fica para uma sprint
nova (relatório de contexto entregue separadamente para colar em uma sessão
`/plan`).

## Decisões tomadas durante a execução

- `.gitignore` recebeu `itau_extrato_*.pdf` **antes** de o arquivo ser lido —
  o CEO colocou o PDF na raiz do repo (`F:\financeiro\itau_extrato_012026.pdf`),
  untracked mas sem regra de ignore, risco real de commit acidental de dado
  financeiro real. Não estava no plano original (que assumia o PDF fora do
  repo), mas segue a mesma regra de "nunca versionar" já registrada no PRD.
- Reconciliação de fevereiro a junho não teve a mesma transcrição manual
  linha a linha de janeiro — decisão tomada com o CEO (pergunta direta) dado
  que o saldo batia ao centavo nos 6 meses e a diferença dos 2 meses com gap
  foi confirmada transação a transação contra uma causa já conhecida.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| 1. Filtro de conta narrows a lista, combinável com os demais filtros | sim | Testes backend (isolado + combinado com `status`) e frontend (`account_id` no request); validado ao vivo na VM de dev (`categorizacao-06-filtro-conta.png`) |
| 2. `account_id` de outro usuário não vaza transação | sim | `test_list_transactions_account_id_cross_user_isolation` (service) + `test_list_transactions_account_id_does_not_leak_other_users_transactions` (endpoint) |
| 3. Todo evento do extrato tem transação correspondente (ou desvio documentado); categorização faz sentido; saldo final bate | sim, com desvio documentado | Ver "Reconciliação jan–jun/2026" — saldo bate a zero em 4/6 meses, diferença dos outros 2 é o lag de fim de semana já decidido como fora de escopo (Sprint 16); zero pendências de categorização |
| 4. Gap real → causa raiz confirmada → correção com teste → revalidação | n/a nesta sprint | Nenhum gap de dado/cálculo real foi encontrado (só o achado de produto, tratado à parte, sem correção nesta sprint por decisão do CEO) |

## Documentação atualizada

- `docs/architecture/OVERVIEW.md` — seção "Filtro de conta em Categorizar +
  Reconciliação contra extrato real (Sprint 17)" + contadores de teste
  atualizados na seção "Qualidade"
- `docs/roadmap.md` — Sprint 17 fechada, novo item em "Registro de
  reavaliações futuras" (categorização de investimentos)
- `.gitignore` — `itau_extrato_*.pdf`
- `docs/directory-structure.md` — sem mudança (nenhum arquivo/diretório novo)

## Consumo estimado de tokens/sessões

Sessão única, dentro do padrão das sprints recentes (cross-epic, sem
migration, sem tela nova).

## Pendências e próximos passos sugeridos

- **Julho e agosto/2026** ficam fora desta reconciliação orientada a
  arquivo — revisão "no olho" numa sessão futura, decisão já registrada no
  PRD-017.
- **Fevereiro a junho sem transcrição manual linha a linha** — só validação
  por saldo agregado (ver "Reconciliação"). Risco residual baixo (saldo bate
  ao centavo), mas não é uma garantia absoluta do mesmo nível que janeiro.
- **Categorização de investimentos (Aporte/Resgate) + tela de Gestão de
  Investimentos + conexão da conta de investimento NuBank via Pluggy** —
  pauta de sprint nova, fora desta sessão. Relatório de contexto entregue
  separadamente ao CEO para colar numa sessão `/plan`.
- **Miscategorização pontual de 03/01/2026** (R$5.000, "Impostos e taxas")
  segue sem correção até a sprint de investimentos definir a categoria certa
  — não é um problema de dado (Pluggy) nem de cálculo (agregação), é
  categorização manual que só faz sentido corrigir junto do desenho novo.
