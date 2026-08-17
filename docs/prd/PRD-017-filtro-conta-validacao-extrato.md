# PRD-017: Filtro de Conta em Categorizar + Validação de Dados/Cálculos contra Extrato Real

- **Status:** aprovado
- **Épico relacionado:** nenhum (sem épico prévio no roadmap — item trazido
  diretamente pelo CEO nesta sessão de planejamento, 2026-08-17)
- **Sprint(s):** [SPRINT-017-filtro-conta-validacao-extrato-plan.md](../sprints/SPRINT-017-filtro-conta-validacao-extrato-plan.md)

## Problema

Da Sprint 5 até a Sprint 16, o projeto construiu categorização, dashboards,
regime competência/caixa, Saldo Acumulado e Patrimônio — mas nunca houve uma
validação linha a linha contra um extrato bancário real, mês a mês, cobrindo
todo o período sincronizado (dez/2025 em diante). A Sprint 16 já corrigiu um
bug real de fuso horário e um bug de resync apagando competência de Salário
confirmado — ambos só apareceram porque alguém comparou contra dado real. O
CEO trouxe o extrato do Itaú do 1º semestre de 2026 (PDF) para fazer essa
validação sistematicamente, gasto a gasto e saldo a saldo, antes de continuar
investindo em funcionalidade nova.

**Decisão explícita do CEO nesta sessão de planejamento:** sem que as contas
estejam corretas, não há razão para desenvolver ou refinar qualquer outra
funcionalidade — esta sprint pausa a evolução de feature nova até a
reconciliação fechar.

## Escopo

- Incluído:
  - Filtro de conta específica (`account_id`) em `GET /categorization/transactions`
    e na tela `CategorizationReviewPage.tsx` — pré-requisito pedido
    explicitamente pelo CEO para isolar uma conta (ex.: "Itaú - Conta
    Corrente") na revisão gasto a gasto.
  - Processo de validação/reconciliação mês a mês (janeiro a junho/2026),
    comparando o extrato real do Itaú (PDF, 1º semestre, já enviado pelo
    CEO) contra o sistema: datas dos eventos, categorização e saldo final
    de cada mês.
  - Correção dos gaps reais encontrados durante a comparação (datas, regras
    de categorização, cálculos de agregação) — escopo exato não
    pré-especificável, depende do que a comparação revelar.
- Fora de escopo (explicitamente):
  - Julho e agosto/2026 — sem extrato formal em mãos; revisão "no olho"
    numa sessão futura, quando as contas já estiverem ajustadas pelas
    correções de jan-jun.
  - Heurística de "lag de dia útil" entre a data do evento (Pluggy) e a
    data de liquidação real do Itaú — decisão já fechada no roadmap
    (Sprint 16); não implementar aqui, mesmo que a comparação reforce a
    necessidade — levar de volta ao CEO explicitamente antes.
  - Qualquer funcionalidade nova fora deste escopo de filtro + validação.
  - Mudar `get_evolucao_saldo_por_conta` (auditoria bancária por conta,
    Sprint 15) — propósito já correto, reaproveitado como está.

## Critérios de aceite

1. Dado o usuário na tela Categorizar, quando seleciona uma conta no filtro
   novo, então a lista de transações mostra só as transações daquela conta
   específica, combinável com os filtros já existentes (status/tipo/ano/mes/
   ativo/categoria).
2. Dado `GET /categorization/transactions?account_id=X`, quando chamado por
   um usuário que não é dono da conta `X`, então nenhuma transação de outro
   usuário vaza (isolamento por `user_id` preservado).
3. Dado o extrato do Itaú de um mês entre janeiro e junho/2026, quando
   comparado contra o sistema (filtro de conta + tabela de auditoria de
   Configurações), então todo evento do extrato tem uma transação
   correspondente no sistema com a data certa (ou desvio documentado e já
   conhecido), a categorização de cada linha faz sentido, e o saldo final do
   mês calculado pela auditoria bate com o saldo final real do extrato.
4. Dado um gap real encontrado na comparação, quando a causa raiz é
   confirmada, então a correção é implementada com teste de regressão e
   revalidada contra o mesmo mês antes de avançar para o mês seguinte.

## Regras de negócio

- **Filtro por conta específica, não por tipo de conta** — o app já suporta
  múltiplas contas do mesmo tipo (`corrente`/`cartao_credito`/etc.);
  filtrar por `account_id` é o único jeito de isolar exatamente a conta que
  se quer bater contra o extrato de um banco específico.
- **Toda correção de gap passa por investigação de causa raiz antes de
  qualquer mudança de código** — mesmo padrão das Sprints 10/15/16: nunca
  corrigir às cegas, confirmar contra dado real, e voltar ao CEO quando a
  causa tocar uma regra de negócio já decidida (tabela de "Decisões fixas"
  do CLAUDE.md ou decisão registrada em roadmap/PRD anterior).
- **Ordem de trabalho mês a mês** — corrigir e revalidar um mês antes de
  avançar para o próximo, para não acumular gaps não confirmados.

## Dados e modelo

- Nenhuma migration prevista para o filtro em si — `pluggy_transactions.account_id`
  já existe desde a Sprint 3, só não era um filtro exposto em
  `/categorization/transactions` (só em `/pluggy/transactions`, via
  `account_tipo`, desde a Sprint 5).
- Migrations/mudanças de schema decorrentes de gaps encontrados na
  reconciliação (Bloco 2) não são previsíveis de antemão — cada uma será
  registrada no relatório de sprint conforme aplicada.

## Segurança

- Isolamento de dados por usuário: filtro `account_id` não muda o padrão
  existente — a query já filtra por `user_id`, e o `account_id` só pode
  pertencer a uma conta do próprio usuário.
- Nenhuma credencial nova envolvida. O extrato do Itaú (PDF) é dado
  financeiro real do CEO — tratado com o mesmo cuidado de qualquer dado
  sensível já existente no projeto (nunca versionado no repo).

## Fora de escopo / decisões adiadas

- Julho/agosto 2026 (revisão "no olho", sessão futura).
- Heurística de lag de dia útil Pluggy vs. Itaú (decisão já fechada,
  Sprint 16).
- Qualquer feature nova fora deste escopo — pausada por decisão do CEO até
  a reconciliação fechar.

## Referências

- [docs/roadmap.md](../roadmap.md) — Sprint 17.
- [PRD-016-regime-competencia-caixa-patrimonio.md](PRD-016-regime-competencia-caixa-patrimonio.md)
  — `get_evolucao_saldo_por_conta`/toggle Competência-Caixa reaproveitados
  como ferramentas de reconciliação nesta sprint.
- [SPRINT-015-configuracoes-competencia-salario-report.md](../sprints/SPRINT-015-configuracoes-competencia-salario-report.md)
  — origem da tabela de auditoria mensal por conta.
- Extrato do Itaú (PDF, 1º semestre de 2026) — fonte externa enviada pelo
  CEO nesta sessão de planejamento, não versionada no repo.
- Plano de execução completo (decisões técnicas, arquivos críticos): plano
  de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-sprint-17-sprint-velvety-map.md`
  — a sessão de execução deve ler este PRD + o plano de sprint associado;
  não é necessário reler o plano de sessão bruto.
