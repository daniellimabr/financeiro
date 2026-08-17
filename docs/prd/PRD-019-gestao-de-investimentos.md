# PRD-019: Gestão de Investimentos

- **Status:** aprovado
- **Épico relacionado:** nenhum (sem épico prévio no roadmap — item registrado em
  "Registro de reavaliações futuras" desde a Sprint 17, formalizado nesta sessão de
  planejamento, 2026-08-17)
- **Sprint(s):** [SPRINT-019-gestao-de-investimentos-plan.md](../sprints/SPRINT-019-gestao-de-investimentos-plan.md)

## Problema

Achado do CEO na reconciliação de saldo das Sprints 17/18: transferências para
investimento (ex. Itaú→NuBank Investimentos) hoje caem em "Transferência interna"
genérica ou, em pelo menos um caso real, ficam miscategorizadas como despesa comum —
inflando indevidamente os totais de Despesa. Casos reais já identificados: R$5.000
(jan/2026, PIX Itaú→NuBank), R$2.052,01 (jan/2026) e R$10.000 (mar/2026, resgate hoje
jogado em "Receitas/Outras" por falta de taxonomia própria). Reconfirmado 2x
(Sprints 17 e 18) durante investigações de outro assunto — sinal de que é um gap
recorrente, não um caso isolado.

Hoje o sistema já tem uma noção rasa de "investimento": `PluggyAccountTipo.investimento`
é só o *fallback* de `_map_account_tipo()` para qualquer conta que não seja
cartão/poupança/corrente (`backend/app/pluggy_integration/service.py`) — sem
granularidade, sem agrupamento definido pelo usuário, sem rastreamento de aporte/resgate
como transação categorizada. O card "Patrimônio" já soma o saldo dessas contas
(`saldo_investimentos`, PRD-016), mas como número único, sem detalhamento por
investimento.

O CEO descreveu o modelo mental desejado nesta sessão: **investimentos são agrupamentos
lógicos que o usuário define, compostos por uma ou mais "carteiras"** — cada carteira é
uma conta de investimento conectada via Pluggy (ex.: Nubank Investimentos, XP, quando
disponível). Um investimento nasce com uma "visão-base": o saldo em 01/01/2026 (definido
manualmente, já que a Pluggy só reporta saldo atual, não histórico). A partir dessa data,
aportes e resgates devem ser registrados como transações categorizadas (com sugestão
automática, a confirmar pelo usuário) — o que já acontece naturalmente, pois essas
transações tocam a conta corrente de origem/destino, não a carteira de investimento em
si. Investimentos também podem gerar renda que se acumula na carteira; como capturar isso
automaticamente via Pluggy é uma incógnita real (nunca investigada neste projeto) — ver
decisão 2 abaixo.

## Decisões do CEO (não reabrir sem pedido explícito)

1. **Aporte e Resgate contam nos totais de Despesa/Receita do Dashboard** — não são
   excluídos como "Transferência interna". Consequência direta: nenhuma mudança é
   necessária em `_base_query`/`_patrimonio_breakdown`
   (`backend/app/dashboards/service.py`), já que a transação de aporte/resgate acontece
   na conta corrente de origem/destino (não numa conta `tipo=investimento`) e já flui
   normalmente pelos totais existentes.
2. **Renda automática de investimento: nesta sprint, só investigar e planejar — não
   implementar captura via API nova da Pluggy.** O CEO vai conectar de verdade a conta
   Nubank Investimentos (e XP, se já disponível como conector) via o fluxo de Connect já
   existente e rodar uma sincronização, para a investigação usar dado real do que a
   integração já existente (`get_accounts`/`get_transactions` genéricos — as rotas
   dedicadas de Investments da Pluggy, `/investments` e `/investments/transactions`,
   nunca foram chamadas neste projeto) efetivamente retorna para uma conta desse tipo. Só
   se um lançamento de rendimento aparecer organicamente nos dados reais é que entra,
   ainda nesta sprint, uma subcategoria "Rendimento" no mesmo padrão de Aporte/Resgate —
   caso contrário, fica documentado como candidato a uma sprint futura de integração
   explícita.

## Escopo

- **Incluído:**
  - Nova entidade `Investimento` (agrupamento lógico do usuário, só `nome`) com CRUD
    completo pela UI.
  - Vínculo carteira→investimento: nova coluna `pluggy_accounts.investimento_id`
    (nullable), editável na tela de gestão de contas — 1 investimento pode ter N
    carteiras.
  - Reaproveitamento do campo já existente `PluggyAccount.saldo_inicial` (Sprint 15) como
    a "visão-base" (saldo em 01/01/2026) de cada carteira — o endpoint
    `PUT /pluggy/accounts/{id}/saldo-inicial` já funciona sem restrição de tipo, só falta
    expor a edição na UI para contas `tipo=investimento`.
  - Aporte/Resgate como subcategorias próprias ("Investimento/Aporte" despesa,
    "Investimento/Resgate" receita), com sugestão automática (mesma cascata
    regra→histórico exato→fuzzy já usada para Ativo/Passivo) e vínculo
    transação→investimento (`investimento_id`/`investimento_sugerido_id`, clone do padrão
    `asset_id`/`asset_sugerido_id`).
  - Tela nova `InvestimentosPage.tsx`: card por investimento (saldo atual, rendimento
    estimado rotulado como estimativa, carteiras vinculadas), drilldown com toggle
    Aporte/Resgate, gráfico de tendência, lista de transações filtrada.
  - Endpoints `GET/POST /investimentos`, `GET/PUT/DELETE /investimentos/{id}`,
    `GET /investimentos/{id}/evolucao`, `GET /dashboards/por-investimento` (+ tendência),
    filtro `investimento_id` em `GET /pluggy/transactions`.
  - Bloco de investigação de renda com dado real (ver "Regras de negócio" e plano de
    sprint) — só documentação/decisão condicional, sem implementação de API nova.
  - Testes automatizados (meta ≥80% cobertura nos módulos tocados).
- **Fora de escopo (explicitamente):**
  - Chamadas às rotas dedicadas de Investments da Pluggy (`/investments`,
    `/investments/transactions`) — candidato a sprint futura, condicionado aos achados do
    bloco de investigação.
  - Conector XP, se ainda não disponível na Pluggy — fora do controle desta sprint.
  - Série histórica de evolução de patrimônio de investimento (snapshot periódico) —
    mesmo gap já registrado para Ativos/Passivos (PRD-008), não resolvido aqui.
  - Bloqueio de vínculo carteira→investimento por tipo de conta no backend — fica só como
    filtro de UI (contas `tipo≠investimento` simplesmente não aparecem no seletor).

## Critérios de aceite

1. Dado um usuário autenticado, quando cria um Investimento (só nome), então ele aparece
   como card na tela `InvestimentosPage`.
2. Dado um Investimento e uma carteira (`PluggyAccount` `tipo=investimento`), quando o
   usuário vincula a carteira ao investimento pela tela de gestão de contas, então o
   saldo da carteira passa a compor o saldo do investimento no card.
3. Dado uma carteira vinculada, quando o usuário define `saldo_inicial` (visão-base de
   01/01/2026), então esse valor entra no cálculo de `saldo_base` do investimento
   (`GET /investimentos/{id}/evolucao`).
4. Dado uma transação de transferência para uma conta de investimento, quando o motor de
   categorização roda, então ela recebe sugestão de subcategoria "Aporte"/"Resgate" e
   sugestão de investimento (se houver regra ou histórico compatível), a confirmar pelo
   usuário — nunca confirmada automaticamente.
5. Dado uma transação confirmada com subcategoria "Aporte" ou "Resgate", então ela conta
   normalmente nos totais de Despesa/Receita do período (decisão 1 do CEO) — teste de
   regressão deve comprovar que a introdução do grupo "Investimentos" não muda nenhum
   total pré-existente para transações não relacionadas.
6. Dado um Investimento com carteiras vinculadas e transações de aporte/resgate
   confirmadas, quando o usuário abre o drilldown na `InvestimentosPage`, então vê total
   do tipo selecionado batendo com `GET /dashboards/por-investimento` e a lista de
   transações batendo com `GET /pluggy/transactions?investimento_id=`.
7. Dado um Investimento, quando o usuário exclui, então ele some da listagem; carteiras
   vinculadas são desassociadas (não excluídas), e transações com `investimento_id`
   apontando para ele são desassociadas (não excluídas).
8. Dado dois usuários diferentes, quando cada um cria/edita/exclui investimentos, vincula
   carteiras ou consulta os endpoints novos, então nunca vê ou altera dado do outro
   usuário.
9. Dado qualquer requisição às rotas novas sem cookie de sessão válido, então recebo 401.
10. Dado o bloco de investigação de renda, quando o CEO conecta e sincroniza a conta real
    de investimento, então os dados reais são inspecionados e os achados documentados no
    relatório de sprint — independentemente do resultado (rendimento capturável ou não
    pela integração atual).
11. Dado o CI, quando a suíte roda, então os testes novos (backend + frontend) passam com
    cobertura ≥80% nos módulos tocados.

## Regras de negócio

- Aporte/Resgate são subcategorias normais (sem `excluir_de_totais`) — decisão 1 do CEO,
  já documentada acima. Isso simplifica a implementação: nenhuma lógica de exclusão nova
  em `_base_query`.
- `rendimento_estimado` (exposto em `GET /investimentos/{id}/evolucao`) é um valor
  **calculado, não medido**: `saldo_atual − saldo_base − total_aportes + total_resgates`,
  onde `total_aportes`/`total_resgates` somam só transações **confirmadas** (não
  sugeridas). Absorve variação de mercado e qualquer renda não capturada pela integração
  — deve ser rotulado como estimativa em toda superfície (API e UI), nunca apresentado
  como dado oficial da Pluggy.
- Carteira (`PluggyAccount` `tipo=investimento`) pertence a no máximo um Investimento por
  vez — vínculo 1:N (Investimento→carteiras), sem tabela de junção, análogo a como
  `asset_id` vive direto em `pluggy_transactions`.
- Excluir um Investimento nunca exclui carteiras ou transações vinculadas — só desassocia
  (mesmo princípio já aplicado a `delete_asset`/`delete_liability`), preservando
  histórico.
- Toda investigação de dado real (bloco de renda) segue o mesmo padrão de causa-raiz já
  usado nas Sprints 10/15/16/17/18: nunca implementar às cegas, confirmar contra dado
  real antes de decidir, e voltar ao CEO se a causa tocar uma decisão já fechada.

## Dados e modelo

- Migration nova (`0015`): tabelas `investimentos` e `investimento_categorization_rules`;
  colunas novas `pluggy_accounts.investimento_id` (FK nullable),
  `pluggy_transactions.investimento_id`/`investimento_sugerido_id`/
  `investimento_sugestao_confianca`; seed do `CategoryGroup` "Investimentos"
  (`excluir_de_totais=false`) com subcategorias "Aporte" (despesa) e "Resgate" (receita),
  padrão de seed via `op.execute(...)` com `ON CONFLICT DO NOTHING` já usado na migration
  0008.
- Nenhuma migration nova para o "saldo-base" — reaproveita `PluggyAccount.saldo_inicial`
  já existente desde a Sprint 15.
- Migration condicional (`0016`), só se o bloco de investigação de renda encontrar dado
  real de rendimento: subcategoria adicional "Rendimento" (receita) no grupo
  "Investimentos".

## Segurança

- Isolamento por usuário em toda tabela/endpoint novo: filtro `user_id` em toda query,
  mesmo padrão já usado por `Asset`/`Liability` (`Depends(get_current_user)`).
- Nenhum secret novo introduzido.
- Nenhuma chamada a serviço externo nova — o bloco de investigação usa só a integração
  Pluggy já existente (`get_accounts`/`get_transactions`), sem tocar credenciais/rotas
  novas.
- Inspeção de dados reais na VM de produção (bloco de renda) segue
  `docs/infra/ssh-workflow.md`: todo comando exige aprovação explícita do CEO, um a um,
  via `scripts/ssh-vm.ps1 prod "..."` (nunca `ssh.exe` direto), e é estritamente
  read-only.

## Fora de escopo / decisões adiadas

- Chamadas às rotas dedicadas de Investments da Pluggy — candidato a sprint futura,
  condicionado aos achados do bloco de investigação desta sprint.
- Conector XP (se ainda não disponível na Pluggy) — fora do controle desta sprint.
- Série histórica de evolução de patrimônio de investimento — mesmo gap adiado desde a
  Sprint 5/6 para Ativos/Passivos (PRD-008).
- Trava de tipo de conta no backend para vínculo carteira→investimento — só filtro de UI
  por ora; revisar se o CEO quiser essa trava mais rígida depois de usar a tela.

## Referências

- [docs/roadmap.md](../roadmap.md) — "Registro de reavaliações futuras" (item
  Categorização de Aporte/Resgate, origem Sprint 17, reconfirmado Sprint 18).
- [PRD-002 — Dados mestres](PRD-002-dados-mestres-migracao-legado.md) (schema `assets`,
  padrão de CRUD original a clonar).
- [PRD-004 — Categorização automática](PRD-004-categorizacao-automatica.md)
  (`asset_id`/`asset_sugerido_id`, heurística de sugestão a clonar para investimento).
- [PRD-008 — Gestão de Ativos](PRD-008-gestao-de-ativos.md) (padrão de tela
  cards+drilldown, endpoints `/dashboards/por-ativo`, a clonar para investimento).
- [PRD-015 — Configurações, competência, salário, saldo acumulado](PRD-015-configuracoes-competencia-salario-saldo-acumulado.md)
  — origem de `PluggyAccount.saldo_inicial`, reaproveitado como visão-base.
- [PRD-016 — Regime competência/caixa, Patrimônio](PRD-016-regime-competencia-caixa-patrimonio.md)
  — origem de `saldo_investimentos` no card Patrimônio, comportamento preservado sem
  mudança.
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) — procedimento para o bloco de
  investigação de renda na VM de produção.
- Plano de execução completo (decisões técnicas, arquivos críticos, clones sugeridos):
  plano de sessão salvo em
  `C:\Users\Daniel\.claude\plans\planejar-sprint-19-para-quiet-treehouse.md` — a sessão de
  execução deve ler este PRD + o plano de sprint associado; não é necessário reler o
  plano de sessão bruto.
