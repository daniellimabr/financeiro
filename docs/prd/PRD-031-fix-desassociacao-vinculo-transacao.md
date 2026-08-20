# PRD-031: Fix — transação presa a vínculo de investimento/ativo/passivo mesmo após desassociação manual

- **Status:** concluído
- **Épico relacionado:** nenhum (bug real reportado pelo CEO usando o app, sem sessão de planejamento prévia)
- **Sprint(s):** [SPRINT-031-fix-desassociacao-vinculo-transacao-plan.md](../sprints/SPRINT-031-fix-desassociacao-vinculo-transacao-plan.md)

## Problema

CEO reportou, usando a tela de Categorização ao vivo: uma transação Pix recebida (Márlon Ismério
De Oliveira Lima, R$ 782,00) não podia ser desassociada do investimento "Tesouro Direto Nubank".
Escolher "Nenhum" no seletor de Investimento parecia não ter efeito — recarregar a tela mostrava o
vínculo de volta.

Documentado retroativamente porque o fix nasceu direto de um bug ao vivo, sem passar por sessão de
`/plan` — a investigação e a decisão de escopo (paliativo vs. definitivo) aconteceram na própria
sessão de execução, via perguntas diretas ao CEO.

## Investigação

Achado por leitura de código (backend + frontend), sem precisar de dado ao vivo na VM:

- O backend gravava `investimento_id = NULL` corretamente — não havia bug de persistência.
- `_apply_suggestions` (`app/categorization/service.py`) recalcula `investimento_sugerido_id`/
  `asset_sugerido_id`/`liability_sugerido_id` **a cada `list_transactions`**, para toda transação
  ainda `pendente`, batendo contra o histórico de vínculos confirmados de outras transações —
  **sem considerar se o usuário já tinha decidido manualmente** (inclusive decidido "nenhum") para
  aquela transação específica.
- O frontend (`InvestimentoSelectCell`/`AssetSelectCell`, `TransactionEditCells.tsx`) prioriza o
  campo de sugestão sobre o valor real ao exibir o `<select>`: `sugerido_id ?? real_id`. Como a
  sugestão voltava a ser recalculada e reencontrava o mesmo match de histórico (Pix recorrente com
  a mesma descrição de aportes anteriores), a UI voltava a mostrar o investimento como vinculado
  mesmo com o banco corretamente em `NULL`.
- O mesmo padrão de bug existe em Categoria (`subcategoria_sugerida_id`), mas com efeito mais
  brando: `set_category` já move `categorizacao_status` para `confirmada`, e transações confirmadas
  saem do recálculo de sugestão — então lá o problema é só a sugestão *antiga* (calculada antes da
  confirmação) sobrepor a categoria escolhida na exibição, não um recálculo repetido.

## Decisões do CEO (não reabrir sem pedido explícito)

Confirmadas nesta sessão, via pergunta direta (`AskUserQuestion`), com duas opções apresentadas:

1. **Fix definitivo com migration**, não paliativo — um paliativo (só limpar o campo de sugestão no
   momento do `set`) resolveria a tela na hora, mas o bug voltaria depois que a transação
   recarregasse na lista enquanto ainda pendente. O CEO escolheu o definitivo.
2. Corrigir os 3 campos (investimento/ativo/passivo) e avaliar se o mesmo padrão afeta Categoria —
   avaliado (ver Investigação acima) e corrigido também.
3. Deploy imediato na VM de dev após o fix (sessão única: implementação → commit → push → CI →
   deploy → validação), sem esperar uma sessão separada — pedido explícito do CEO dado que o app
   real estava com o vínculo travado.

## Escopo

### Incluído

- Migration `0020`: 3 colunas booleanas novas em `pluggy_transactions`
  (`asset_confirmado_manualmente`, `liability_confirmado_manualmente`,
  `investimento_confirmado_manualmente`), default `false`.
- `set_transaction_asset`/`set_transaction_liability`/`set_transaction_investimento` passam a
  marcar a flag correspondente e limpar o campo `*_sugerido_id`/`*_sugestao_confianca` ao gravar a
  escolha manual do usuário — inclusive quando o valor escolhido é `None`.
- `_apply_suggestions` pula a recomputação de sugestão para qualquer campo já marcado como
  confirmado manualmente naquela transação.
- `set_category`/`bulk_confirm` passam a limpar `subcategoria_sugerida_id` e os campos de sugestão
  associados ao confirmar — mesmo padrão de correção, sem precisar de coluna nova (o
  `categorizacao_status` já existente cumpre o papel do flag).

### Fora de escopo (explicitamente)

- Reverter/limpar a flag de confirmação manual automaticamente (ex.: se a Pluggy re-sincronizar a
  transação) — não há caso de uso identificado para isso hoje.
- Corrigir transações já afetadas pelo bug antes deste fix (a `investimento_sugerido_id`/
  `asset_sugerido_id`/`liability_sugerido_id` já presas em valores antigos na VM de dev) — a
  próxima interação manual do usuário com cada uma resolve o caso individualmente; sem backfill em
  massa.
- QA visual automatizado (script `browser-check`) — validação ficou por conta do CEO usando a tela
  real após o deploy.

## Critérios de aceite

1. Dada uma transação com investimento sugerido pelo motor (via regra ou histórico), quando o
   usuário escolhe "Nenhum" manualmente, então `investimento_id` e `investimento_sugerido_id` ficam
   `NULL` e **permanecem `NULL`** em qualquer `list_transactions` subsequente, mesmo com a
   transação ainda pendente e o mesmo padrão de descrição presente no histórico de outras
   transações.
2. O mesmo vale para `asset_id`/`asset_sugerido_id` e `liability_id`/`liability_sugerido_id`.
3. Dada uma transação confirmada com categoria diferente da última sugestão calculada,
   `subcategoria_sugerida_id` fica `NULL` após a confirmação (não sobrepõe a categoria escolhida na
   exibição).
4. Suíte de testes 100% verde, sem regressão, cobrindo os 4 cenários acima como testes de
   regressão explícitos.
5. Migration reversível, aplicada com sucesso contra o Postgres real da VM de dev (entrypoint do
   container, não execução manual).

## Regras de negócio

- Uma vez que o usuário decide manualmente um vínculo de asset/liability/investimento para uma
  transação (inclusive decidindo que não há vínculo), essa decisão nunca é sobrescrita
  automaticamente pelo motor de sugestão — só uma nova ação manual do próprio usuário muda o valor.
- Essa regra não se aplica a Categoria da mesma forma porque toda transação categorizada já vira
  `confirmada` (não fica "pendente" indefinidamente como pode acontecer com investimento/ativo/
  passivo, que não têm status próprio).

## Dados e modelo

- Migration `0020` (reversível): 3 colunas `Boolean NOT NULL DEFAULT false` em
  `pluggy_transactions`. Sem backfill — transações existentes nascem com as 3 flags `false`
  (comportamento pré-fix até a próxima interação manual do usuário com cada uma).

## Segurança

- Nenhum dado sensível novo. Nenhum secret. Sem mudança de isolamento por usuário (os setters já
  filtravam por `user_id`).

## Referências

- Investigação inicial via subagente Explore (mesma sessão, achado da causa raiz).
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) — ciclo de deploy (dev VM) e gotcha
  de `alembic upgrade head` automático via entrypoint.
