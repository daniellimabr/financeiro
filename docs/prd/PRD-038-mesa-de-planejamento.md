# PRD-038: Mesa de Planejamento (substitui Orçamento e fecha a lacuna de Projeção)

- **Status:** aprovado
- **Épico relacionado:** E12 Planejamento financeiro (novo — ver [docs/roadmap.md](../roadmap.md))
- **Sprint(s):** [SPRINT-038](../sprints/SPRINT-038-mesa-de-planejamento-plan.md)

## Problema

O CEO quer conseguir olhar para os próximos meses e ver quais receitas/despesas são esperadas —
por serem fixas ou variáveis recorrentes — incluindo, no mês corrente, quanto do que foi
planejado já foi cumprido ou excedido. Essa pergunta já foi atacada duas vezes:

1. **Projeção** (Sprint 14, [PRD-014](PRD-014-projecao-custos-hipoteticas.md)) — tela dedicada,
   projeção automática (média móvel de 3 meses) aplicada silenciosamente, simulação "hipotéticas"
   efêmera. Removida por completo na Sprint 30 — "não serviu ao propósito".
2. **Orçamento** (Sprint 30, [PRD-030](PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md))
   — meta manual por subcategoria (eventual ou recorrente), barra orçado-vs-realizado só do mês
   filtrado no Dashboard. Decisão do CEO nesta sessão de planejamento (2026-09-11), registrada
   como mensagem principal: **Orçamento não está em uso e deve ser eliminado por completo**, não
   estendido.

Sessão de planejamento incluiu comparação de 4 direções via Artifact
(`Mesa de Planejamento`, publicado durante a conversa). O CEO escolheu a direção "Mesa de
Planejamento" — tela nova, nascida do zero, que não estende nem convive com o Orçamento atual —
com uma correção explícita: a automação da sugestão (média 3 meses) nunca aplica silenciosamente,
sempre pede confirmação do usuário.

## Escopo

### Incluído

**Remoção completa do Orçamento (Sprint 30):**
- Backend: model `Orcamento`/`OrcamentoTipo` (`app/models/orcamento.py`), módulo
  `app/orcamentos/` inteiro, `OrcamentoStatus`/`get_orcamento_status`/`OrcamentoStatusOut`/rota
  `GET /dashboards/por-orcamento` em `app/dashboards/`, migration nova derrubando a tabela
  `orcamentos`.
- Frontend: `OrcamentoPage.tsx`+teste, `api/orcamentos.ts`, hooks
  `useOrcamentos`/`useCreateOrcamento`/`useUpdateOrcamento`/`useDeleteOrcamento`/
  `useDashboardPorOrcamento`, aba "Orçamento" em `ProtectedPage.tsx`, barra orçado-vs-realizado em
  `DashboardsPage.tsx` (`Row`/`SubcategoriaAccordion`, integrada na Fase 7 da Sprint 30) e
  referências em `invalidateDashboardQueries.ts`.
- Sem dado real em uso (confirmado pelo CEO) — migration de downgrade não precisa preservar
  linhas, só reverter o schema.

**Mesa de Planejamento — mecanismo novo, tabelas novas:**
- Grade subcategoria (linha) × mês (coluna): 3 meses de histórico (realizado, só leitura, base
  visível da sugestão) + mês corrente + 12 meses futuros (horizonte fixo nesta sprint — decisão do
  CEO, revisitar se insuficiente). Só entram subcategorias com `natureza` `fixa`/`variavel`,
  despesa e receita juntas, agrupadas por seção.
- Sugestão automática (média dos últimos 3 meses com transação real, mesma janela/regra de
  exclusão de `_base_query` já usada em todo dashboard) aparece pré-preenchida em cada mês futuro
  como **pendente de confirmação** — nunca aplicada silenciosamente. Usuário confirma o valor
  sugerido como está ou digita outro; a partir daí o mês fica "confirmado" (persistido).
- Mês corrente mostra, lado a lado: valor planejado (confirmado ou sugerido) e realizado-até-agora
  do mês, com indicador dentro/excedido — despesa: exceder é o alerta; receita: não alcançar é o
  alerta (mesmo sentido já definido em PRD-030).
- **Itens planejados**: lançamento livre, sem subcategoria/histórico obrigatório (nome, valor,
  débito ou crédito, mês-alvo único ou recorrente com data de início/fim opcional), aparece na
  grade no(s) mês(es) correspondente(s). Quando a transação real correspondente acontece, o item
  pode ser vinculado a ela (busca simples por período/tipo) e passa a aparecer como "cumprido" —
  para de contar como hipotético, mostra link pra transação real.
- Endpoints novos isolados por `user_id`, mesmo padrão de todo `app/dashboards/*`/`app/orcamentos/*`
  anterior.
- Tela `PlanejamentoPage.tsx` nova — grade com scroll horizontal e primeira coluna/cabeçalho
  fixos, pastilhas de estado (realizado/sugerido/confirmado/hipotético), edição inline de
  sugestão, seção de itens planejados com CRUD e ação de vínculo. Aba "Planejamento" substitui
  "Orçamento" em `ProtectedPage.tsx`.
- Rodada de design (Impeccable/Artifact) para o vocabulário visual novo (pastilhas de estado,
  grade densa, seção de itens planejados) — mesmo padrão usado para a barra orçado-vs-realizado na
  Sprint 30.
- Testes automatizados (meta ≥80% cobertura nos módulos novos) e
  `scripts/browser-check/check-sprint38.mjs` novo.

### Fora de escopo (explicitamente)

- **Toggle "Modo Projeção" no Dashboard** — ideia do CEO nesta sessão (Dashboard ganharia um botão
  pra exibir dado da Mesa de Planejamento em modo só-leitura). Decisão explícita: "avaliamos a
  utilidade depois" — nem entra nesta sprint, nem é fast-follow com sprint numerada ainda.
  Candidato futuro, registrado no roadmap.
- **Fatura futura de cartão de crédito como abatimento automático** — a Pluggy já expõe fatura
  futura (dado que o CEO confirmou já ter acessado); quando ela cobrir parte do valor sugerido de
  uma subcategoria, deveria abater em vez de somar. Fast-follow já combinado, sprint futura
  numerada quando priorizada.
- Horizonte configurável além de 12 meses fixos, ou janela de sugestão diferente de 3 meses.
- Qualquer mudança em `Natureza`/`NaturezaPage.tsx`, `Subcategory`/`CategoryGroup` além de leitura.
- Compartilhamento de Mesa de Planejamento entre os 2 usuários da família — cada um vê e edita só
  a sua, mesma decisão já tomada para o Orçamento anterior.

## Critérios de aceite

1. Dado o Orçamento anterior, nenhuma rota, tabela, componente, teste ou item de menu referente a
   ele permanece no código ou no schema após esta sprint.
2. Dada a tela Planejamento, quando aberta, o usuário vê uma grade com subcategorias fixa/variável
   (despesa e receita) nas linhas e 3 meses de histórico + mês corrente + 12 meses futuros nas
   colunas.
3. Dado um mês futuro sem confirmação prévia, sua célula mostra a média dos últimos 3 meses como
   sugestão, visualmente distinta de um valor já confirmado — nenhum valor sugerido é tratado como
   confirmado sem ação explícita do usuário.
4. Dado o usuário confirma ou edita o valor de uma célula futura, o valor persiste e volta
   idêntico numa nova sessão/reload.
5. Dado o mês corrente, a grade mostra o valor planejado e o realizado-até-agora lado a lado, com
   indicador de excedido (despesa) ou não-alcançado (receita).
6. Dado um item planejado criado (único ou recorrente), ele aparece na grade no(s) mês(es)
   correspondente(s), mesmo sem subcategoria com histórico.
7. Dado um item planejado vinculado a uma transação real, ele passa a exibir status "cumprido" com
   link pra transação, e para de ser contado como hipotético dali em diante.
8. Dado o endpoint de grade, quando chamado sem autenticação ou por outro usuário, retorna
   401/dados isolados por `user_id`, mesmo padrão de todos os endpoints de dashboard/planejamento.
9. Dado o CI, a suíte roda 100% verde com cobertura ≥80% nos módulos novos/tocados.

## Regras de negócio

- Só subcategorias com `natureza` `fixa` ou `variavel` entram automaticamente na grade —
  `eventual`/sem natureza seguem fora da base projetada (mesma premissa da antiga Projeção);
  qualquer despesa/receita eventual futura que o usuário queira acompanhar entra via Item
  Planejado, não via subcategoria.
- Sugestão = média dos últimos 3 meses com transação real na subcategoria, aplicando as mesmas
  exclusões de todo agregador de dashboard (`excluir_de_totais`, `tipo=credito` em cartão de
  crédito nunca é receita).
- Um valor de mês futuro só é "confirmado" após ação explícita do usuário (aceitar a sugestão como
  está, ou editá-la) — nunca por default/silêncio.
- Item planejado: `único` vale só no mês-alvo; `recorrente` vale de `data_inicio` até `data_fim`
  (vazio = até o fim do horizonte de 12 meses exibido, não "ad eternum" fora da tela). Vínculo a
  transação real é opcional e reversível (desvincular volta o item a "hipotético").
- Em Despesa, ultrapassar o planejado é o alerta; em Receita, não alcançar é o alerta — mesmo
  sentido definido em PRD-030, aplicado agora ao mês corrente da Mesa de Planejamento.
- Isolamento por usuário em toda tabela/consulta nova, sem exceção.

## Dados e modelo

- Migration removendo a tabela `orcamentos` e o enum `orcamento_tipo` (sem preservação de dado —
  confirmado pelo CEO como não utilizado).
- Tabela nova `planejamento_valores` (`user_id`, `subcategory_id`, `ano`, `mes`, `valor`,
  `UniqueConstraint(user_id, subcategory_id, ano, mes)`) — só guarda valores confirmados; ausência
  de linha = célula ainda "sugerida", calculada on-the-fly.
- Tabela nova `itens_planejados` (`user_id`, `nome`, `tipo` débito/crédito, `valor`, `data_inicio`,
  `recorrente` bool, `data_fim` opcional, `transacao_vinculada_id` FK `pluggy_transactions.id`
  nullable e único).
- Nenhuma mudança em `Subcategory`/`CategoryGroup`/`PluggyTransaction` além de leitura.

## Segurança

- Toda tabela nova isolada por `user_id`, mesmo padrão de `assets`/`liabilities`/`orcamentos`.
- Vínculo de item planejado só pode apontar para transação do próprio usuário — validado no
  service, mesmo padrão de `asset_id`/`liability_id` em `pluggy_transactions`.
- Nenhum secret novo. Migration de remoção do Orçamento não preserva dado (confirmado como
  aceitável pelo CEO).

## Referências

- [PRD-014 — Projeção de custos futuros com hipotéticas](PRD-014-projecao-custos-hipoteticas.md)
  — origem do cálculo de sugestão por média móvel, removida na Sprint 30, redesenhada aqui como
  confirmação explícita em vez de aplicação automática.
- [PRD-030 — Categorias por usuário, Orçamento...](PRD-030-categorias-por-usuario-orcamento-gestao-categorias.md)
  — mecanismo eliminado por esta sprint; origem do sentido de alerta despesa/receita reaproveitado
  aqui.
- Artifact de sessão de planejamento "Mesa de Planejamento" (2026-09-11) — comparação de 4
  direções (Timeline no Orçamento, Dashboard estendido, Mesa de Planejamento, Horizonte) e
  convergência na direção escolhida.
