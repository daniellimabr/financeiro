# PRD-016: Regime de Competência/Caixa e Patrimônio por Saldo Acumulado

- **Status:** aprovado
- **Épico relacionado:** novo (sem épico prévio no roadmap — item trazido
  diretamente pelo CEO nesta sessão de planejamento, 2026-08-17)
- **Sprint(s):** [SPRINT-016-regime-competencia-caixa-plan.md](../sprints/SPRINT-016-regime-competencia-caixa-plan.md)

## Problema

O CEO trouxe uma planilha (Google Sheets, fórmulas inspecionadas célula a
célula) para validar sua leitura de como somas/saldos deveriam funcionar, e
formalizar a lógica de competência. Duas lacunas reais foram confirmadas
contra o código atual:

1. **Competência de cartão de crédito nunca foi implementada.** Hoje toda
   transação sincronizada recebe `data_competencia = data` (data real do
   evento), sem exceção — só "Salário" tem regra de deslocamento (Sprint
   15). O CEO quer que toda transação de cartão de crédito (débito ou
   crédito) tenha `data_competencia` sempre no mês seguinte ao evento,
   incondicional — sem dia de corte configurável como salário.
2. **Não existe "visão caixa" separada de competência.** As fórmulas da
   planilha confirmam: `Despesas Cartão (caixa, mês M) = Despesas Cartão
   (competência, mês M−1)` — a visão caixa do cartão fica mais um mês
   atrás da competência (evento + 2 meses no total). Débito em conta
   corrente não tem essa defasagem — mesmo valor nas duas visões.

Adicionalmente, durante a investigação de 3 transações reais que o CEO
reportou como divergentes do extrato do Itaú, foi confirmado um bug real de
fuso horário na gravação de `data` (ver "Regras de negócio").

## Escopo

- Incluído:
  - Competência incondicional de cartão de crédito (`data_competencia =
    evento + 1 mês`, sem dia de corte).
  - Novo conceito `data_caixa` (persistido, calculado nos mesmos 3 pontos
    de escrita que `data_competencia` hoje).
  - Toggle "Competência" (default) / "Caixa" em todas as telas/cards do
    Dashboard (Receita/Despesa/Saldo do período, tendência, drill-downs de
    Categoria/Ativo/Passivo, Saldo Acumulado/Anterior, Patrimônio).
  - Patrimônio deixa de ser só snapshot ao vivo da Pluggy e passa a ser
    `Saldo Acumulado (líquido, no regime selecionado) + saldo ao vivo de
    investimentos + Ativos − Passivos`.
  - Saldo Acumulado líquido exclui contas de investimento (variação de
    valor de mercado não é uma transação).
  - Correção do bug de fuso horário em `_parse_date`
    (`app/pluggy_integration/service.py`), que grava `data` um dia à frente
    do real para transações com timestamp UTC entre 00:00 e ~03:00.
- Fora de escopo (explicitamente):
  - Toggle nas telas "Natureza" e "Projeção" — ficam só por competência.
  - Heurística de "empurrar data de fim de semana pro próximo dia útil"
    (divergência confirmada entre a data do evento reportada pela Pluggy e
    a data de liquidação do Itaú, sem outro campo no payload para corrigir
    automaticamente) — decisão explícita do CEO de não implementar agora,
    risco de trocar um erro por outro sem tratar feriados.
  - Mudar `get_evolucao_saldo_por_conta` (auditoria bancária por conta,
    `data` real, sem exclusões) — propósito distinto, já correto.
  - Lançamento manual de transação genérico.

## Critérios de aceite

1. Dado o sync de uma transação em conta `cartao_credito`, quando gravada,
   então `data_competencia` é sempre o mês seguinte ao de `data` (clamp de
   dia via `calendar.monthrange`), independente de dia de corte.
2. Dado o mesmo caso, então `data_caixa` é o mês seguinte a
   `data_competencia` (evento + 2 meses no total).
3. Dado qualquer transação em conta não-cartão, então `data_caixa =
   data_competencia` (inclusive quando `data_competencia` já foi deslocada
   pela regra de Salário).
4. Dado o Dashboard carregado, quando o usuário alterna o toggle
   Competência/Caixa, então Receita/Despesa/Saldo do período, tendência,
   drill-downs de Ativo/Passivo, Saldo Acumulado/Anterior e Patrimônio
   recarregam consistentemente com o regime selecionado.
5. Dado o Saldo Acumulado, quando calculado, então contas `tipo=investimento`
   não entram na soma de `saldo_inicial`/acumulação — o Patrimônio soma de
   volta o saldo ao vivo dessas contas separadamente.
6. Dado uma conta líquida (não-investimento) sem `saldo_inicial`
   preenchido, quando o Patrimônio é calculado, então o saldo ao vivo dessa
   conta específica entra no total como fallback, sem quebrar o cálculo das
   demais contas.
7. Dado o backfill da migration, quando aplicado, então `data_competencia`
   de transações históricas de cartão de crédito reflete o novo shift, e
   `data_caixa` é populado para toda transação existente.
8. Dado o bug de fuso corrigido, quando uma conta é re-sincronizada
   (`POST /pluggy/sync`), então transações com timestamp UTC entre 00:00 e
   ~03:00 passam a gravar `data` no dia correto em horário de Brasília
   (caso de verificação: transação "BRASA E DRINKS", `date` bruto
   `2026-01-23T01:34:27Z`, deve gravar `2026-01-22`).

## Regras de negócio

- **Competência de cartão de crédito:** `data_competencia =
  shift_to_next_month(data)` para toda transação de conta
  `tipo=cartao_credito`, sempre — sem dia de corte (diferente de Salário).
- **Caixa:** `data_caixa = shift_to_next_month(data_competencia)` para
  cartão; `data_caixa = data_competencia` para qualquer outro tipo de
  conta.
- **Regime é parâmetro de leitura, não de gravação:** `data_competencia` e
  `data_caixa` são colunas persistidas, calculadas nos 3 pontos de escrita
  (sync, categorização, ajuste de salário dez/2025); o toggle do frontend
  só decide qual coluna cada agregação usa para filtrar/agrupar.
- **Saldo Acumulado líquido exclui investimento:** soma `saldo_inicial` e
  transações só de contas `tipo != investimento`.
- **Fallback de conta sem `saldo_inicial`:** entra no Patrimônio pelo saldo
  ao vivo, fora da acumulação — não bloqueia nem distorce as demais contas.
- **Bug de fuso horário:** `_parse_date` deve converter o timestamp UTC
  bruto da Pluggy para `America/Sao_Paulo` antes de extrair a data — hoje
  extrai a data direto do UTC, causando erro de um dia para trás quando o
  horário local (BRT) da transação cai entre 21:00 e 23:59 do dia anterior
  (equivalente a 00:00–03:00 UTC do dia seguinte).
- **Sem heurística de dia útil para o lag Pluggy vs. extrato real:**
  documentado como limitação conhecida — não implementar nesta sprint.

## Dados e modelo

- `pluggy_transactions.data_caixa` (Date, nullable) — migration `0013`.
- Migration `0013` inclui backfill em Python (mesmo precedente das
  migrations `0007`/`0012`) de `data_competencia` para transações de
  cartão de crédito e `data_caixa` para toda transação existente.
- `PatrimonioBreakdown` muda de forma: `saldo_contas`/`saldo_cartoes`
  (ambos snapshot ao vivo) viram `saldo_liquido_acumulado` (via
  `get_saldo_acumulado`, respeitando o regime) + `saldo_investimentos`
  (snapshot ao vivo, só contas de investimento).
- Sem migration para o bug de fuso — correção de código; dado histórico se
  autocorrige via re-sync (upsert idempotente já sobrescreve `data` a cada
  sync).

## Segurança

- Isolamento de dados por usuário: sem mudança — toda função nova/alterada
  em `app/dashboards/service.py` mantém o filtro `user_id` existente.
- Nenhuma credencial nova envolvida.

## Fora de escopo / decisões adiadas

- Extensão do toggle às telas "Natureza"/"Projeção".
- Heurística de dia útil para o lag Pluggy vs. extrato bancário real —
  candidata a revisão futura se o CEO priorizar, possivelmente dependente
  de a Pluggy expor um campo de data de liquidação que hoje não existe no
  payload.

## Referências

- [docs/roadmap.md](../roadmap.md) — Sprint 16.
- Planilha de referência do CEO (Google Sheets, fórmulas inspecionadas
  nesta sessão de planejamento) — modela as duas visões (competência/
  caixa) e a fórmula de Patrimônio; não versionada no repo (fonte externa).
- Plano de execução completo (decisões técnicas, assinaturas de função,
  arquivos críticos): plano de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-nossa-proxima-sprint-greedy-gray.md`
  — a sessão de execução deve ler este PRD + o plano de sprint associado;
  não é necessário reler o plano de sessão bruto.
