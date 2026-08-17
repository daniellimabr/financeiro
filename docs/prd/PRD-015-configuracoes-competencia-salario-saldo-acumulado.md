# PRD-015: Configurações, Competência de Salário e Saldo Acumulado

- **Status:** aprovado
- **Épico relacionado:** [E7 — Conta e perfil](../roadmap.md)
- **Sprint(s):** [SPRINT-015-configuracoes-competencia-salario-plan.md](../sprints/SPRINT-015-configuracoes-competencia-salario-plan.md)

## Problema

Três dores distintas, resolvidas juntas porque a segunda e a terceira só
fazem sentido depois da primeira:

1. **Sem logout, sem perfil, sem tela de configurações.** `GET /auth/me`
   existe, mas não há `POST /auth/logout` nem UI pra sair da conta; a aba
   "Gestão de contas" acumula responsabilidade que deveria estar num lugar
   próprio (perfil, competência de salário).
2. **`data_competencia` não tem regra pra salário.** Hoje é sempre igual à
   data real da transação (Sprint 5). Sem uma regra de competência, salário
   pago no fim do mês (referente ao trabalho daquele mês) aparece como
   receita do mês seguinte nos relatórios, distorcendo Receita/Saldo mês a
   mês.
3. **O corte de sincronização Pluggy (`2026-01-01`) nunca trouxe o salário
   real de dez/2025** (cuja competência passa a ser jan/2026 pela nova regra)
   **nem o saldo real das contas até aquela data.** Sem esses dois valores
   informados manualmente: jan/2026 fica com receita subestimada, e não há
   como o CEO auditar se o saldo calculado de cada conta bate com o extrato
   bancário real mês a mês.

## Escopo

- Incluído:
  - `POST /auth/logout`; tela "Configurações" (substitui a aba "Gestão de
    contas") com 3 seções: Perfil (nome/e-mail/logout), Gestão de Contas
    (conteúdo atual reaproveitado + saldo inicial por conta), Competência de
    Salário (dia de corte + formulário de salário de dez/2025).
  - Regra de competência de salário: dia de corte configurável por usuário
    (default 25), recalculada toda vez que uma transação é confirmada/
    reconfirmada na subcategoria "Salário" (ou tira dela).
  - Salário de dez/2025 informado como uma transação real (conta + data +
    valor), aparecendo normalmente no drill-down de jan/2026.
  - Saldo inicial por conta (31/12/2025) + ferramenta de auditoria mensal
    por conta (data real da transação, para bater com extrato bancário).
  - Métrica nova "Saldo Acumulado" (agregada, por competência) com dois
    cards no Dashboard: "Saldo Acumulado" (mês filtrado) e "Saldo Anterior"
    (primeiro card da grid, mês anterior, navega o filtro da tela ao
    clicar).
- Fora de escopo (explicitamente):
  - Feature geral de lançamento manual de transação (o formulário de
    salário de dez/2025 é dedicado a esse valor específico).
  - Mudar a semântica do card "Saldo" (receita−despesa do período) em
    qualquer tela — Saldo Acumulado é aditivo.
  - Tela de gestão de usuários (convidar/remover) — "multiusuário" já está
    coberto arquiteturalmente (isolamento por `user_id`, login individual),
    sem trabalho novo necessário; decisão do CEO de tratar eventual UI de
    gestão de usuários numa sprint futura.
  - Deduplicar o padrão de edição inline (apelido vs. saldo inicial) em
    `AccountManagementPage.tsx`.

## Critérios de aceite

1. Dado um usuário autenticado, quando ele chama `POST /auth/logout`, então
   o cookie `financeiro_session` é limpo e chamadas seguintes a `GET
   /auth/me` retornam 401.
2. Dado o menu do app, quando o usuário olha a navegação, então "Gestão de
   contas" não existe mais como aba própria — existe "Configurações", com
   Perfil, Gestão de Contas e Competência de Salário como seções de uma
   página só.
3. Dado o dia de corte configurado (default 25), quando uma transação é
   confirmada na subcategoria "Salário" com `data.day >= cutoff`, então
   `data_competencia` vira o mês seguinte (com rollover de ano quando
   aplicável); quando `data.day < cutoff`, `data_competencia` fica no mesmo
   mês de `data`.
4. Dado que uma transação categorizada como "Salário" é recategorizada para
   outra subcategoria, então `data_competencia` volta a ser igual a `data`.
5. Dado o formulário "Salário de dezembro/2025" preenchido (conta, data,
   valor), quando salvo, então uma transação aparece no drill-down de
   Receita → Categoria "Receitas" → Tipo "Salário" do Dashboard filtrado
   para jan/2026, com o valor informado, e soma normalmente em
   `GET /dashboards/summary`/`/tendencia`/`/por-categoria` daquele mês —
   sem nenhum código especial nessas três funções.
6. Dado o campo "Saldo inicial (31/12/2025)" preenchido para uma conta,
   quando o CEO consulta a tabela de auditoria dessa conta em
   Configurações, então vê o saldo calculado mês a mês (saldo inicial +
   soma cumulativa de `valor` por `data` real, desde 2026-01-01) — sem
   excluir cartão de crédito, sem qualquer filtro de competência.
7. Dado saldo inicial configurado em pelo menos uma conta, quando o
   Dashboard carrega, então aparecem os cards "Saldo Acumulado" (valor do
   mês filtrado) e "Saldo Anterior" (primeiro card, valor do mês anterior,
   rotulado com o mês/ano).
8. Dado o filtro do Dashboard em qualquer mês exceto jan/2026, quando o
   usuário clica em "Saldo Anterior", então o filtro ano/mês da tela muda
   para o mês anterior e todos os cards recarregam nesse período.
9. Dado o filtro do Dashboard em jan/2026, quando o usuário clica em "Saldo
   Anterior", então nada navega — aparece um alerta indicando que é o
   início do registro histórico.

## Regras de negócio

- **Identificação de "Salário"**: por subcategoria (grupo "Receitas", nome
  "Salário" — já existe no catálogo importado do legado), nunca por texto de
  descrição.
- **Cálculo de competência**: `shift_to_next_month` com clamp de dia via
  `calendar.monthrange` (evita datas inválidas em fevereiro/rollover de
  ano). Dia de corte é **por usuário** — isolamento de dados obrigatório
  também nesta regra.
- **Recalcula sempre, não só ao entrar em Salário**: toda chamada de
  `set_category`/`bulk_confirm` recalcula `data_competencia` (reset pra
  `data` quando o alvo não é Salário) — garante que recategorizar uma
  transação pra fora de Salário desfaça o deslocamento.
- **Transação sentinela de salário de dez/2025**: upsert por
  `pluggy_transaction_id` determinístico (nunca colide com id externo real
  da Pluggy), já criada com `categorizacao_status=confirmada` e
  `subcategory_id` de Salário — flui por toda agregação existente sem caso
  especial. Fica sujeita às mesmas regras de edição de qualquer transação
  confirmada (pode ser editada depois pela tela de Categorização).
- **Saldo inicial por conta ≠ Saldo Acumulado agregado**: a auditoria por
  conta (D) usa `data` real, sem excluir nada — reconciliação bancária
  literal. O Saldo Acumulado agregado (E) usa `data_competencia` (mesmo eixo
  de Receita/Despesa/Saldo do Dashboard) e por isso precisa subtrair o valor
  da transação sentinela de salário da âncora de dez/2025 (que já entra de
  volta, sozinho, na receita de jan/2026).
- **Saldo Anterior em jan/2026**: caso especial fixo, não generalizável —
  dez/2025 nunca é um mês navegável no Dashboard (não há transações
  sincronizadas antes do corte Pluggy).

## Dados e modelo

- `users.salario_competencia_cutoff_dia` (int, default 25) — migration nova.
- `pluggy_accounts.saldo_inicial` (numeric, nullable) — migration nova.
- Nenhuma coluna nova em `pluggy_transactions` — a transação de salário de
  dez/2025 usa as colunas já existentes, identificada só pelo
  `pluggy_transaction_id` sentinela.
- Migration `0012` inclui backfill (Python, não SQL puro) de
  `data_competencia` para transações já categorizadas como Salário antes
  desta sprint, usando o cutoff padrão (25).

## Segurança

- Isolamento de dados por usuário: dia de corte, saldo inicial por conta e
  transação sentinela de salário são todos escopados a `user_id`, seguindo o
  mesmo padrão de toda tabela transacional do projeto.
- Nenhuma credencial nova envolvida (não há integração externa nova nesta
  sprint).

## Fora de escopo / decisões adiadas

- Feature geral de lançamento manual de transação.
- UI de gestão de usuários (convidar/remover) — "multiusuário" (item 11 do
  escopo original) decidido pelo CEO como tratamento futuro; arquitetura já
  suporta (isolamento por `user_id`, ~10 usuários sem retrabalho).
- Deduplicar o padrão de edição inline em `AccountManagementPage.tsx`
  (apelido vs. saldo inicial) num componente compartilhado.

## Referências

- [docs/roadmap.md](../roadmap.md) — E7, histórico de reordenação das
  Sprints 12→13→14→15.
- [SPRINT-014-projecao-custos-hipoteticas-report.md](../sprints/SPRINT-014-projecao-custos-hipoteticas-report.md)
  — registra Sprint 15 como próxima da fila.
- Plano de execução completo (todas as decisões técnicas, assinaturas de
  função, arquivos críticos): plano de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-sprint-15-swift-otter.md` — a
  sessão de execução deve ler este PRD + o plano de sprint associado; não é
  necessário reler o plano de sessão bruto.
