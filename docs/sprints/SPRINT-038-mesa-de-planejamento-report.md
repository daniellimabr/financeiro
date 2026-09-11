# SPRINT-038: Mesa de Planejamento — Relatório

- **Plano:** [SPRINT-038-mesa-de-planejamento-plan.md](./SPRINT-038-mesa-de-planejamento-plan.md)
- **PRD:** [PRD-038-mesa-de-planejamento.md](../prd/PRD-038-mesa-de-planejamento.md)
- **Data do relatório:** 2026-09-11
- **Aguardando aprovação do CEO** — deploy na VM de dev e validação ao vivo já feitos antes da
  aprovação formal, mesmo padrão das Sprints 34-37 (deploy como tarefa da própria sprint).

## Resumo

Abre o épico E12 (Planejamento financeiro), sucessor de E9 (Projeção, removida na Sprint 30) e do
mecanismo de Orçamento (Sprint 30, PRD-030), eliminado por completo nesta sprint após 8 sprints sem
uso real confirmado pelo CEO. Entrega a Mesa de Planejamento: grade de 16 colunas (3 meses de
histórico + mês corrente + 12 futuros) por subcategoria `fixa`/`variavel`, sugestão automática por
média móvel de 3 meses sempre pendente de confirmação explícita, e Itens Planejados (lançamento
livre, com vínculo opcional a uma transação real).

Implementado, testado (backend 688 testes/99% cobertura, 100% em `app/planejamento`; frontend 295
testes), commitado em 4 commits (feature backend/Fase 0-2, style/Prettier, feature frontend/Fase 4,
docs), CI verde confirmado por `head_sha` exato em cada push relevante, deployado na VM de dev
(migrations `0022`/`0023` aplicadas), e validado ao vivo com
`scripts/browser-check/check-sprint38.mjs` — 2 achados reais encontrados e corrigidos no processo
(ver "Achados do browser-check e da execução").

## Sequenciamento real da execução

1. **Fase 0 — Remoção completa do Orçamento**: model, módulo `app/orcamentos/`, rota
   `GET /dashboards/por-orcamento`, migration `0022_drop_orcamentos.py`; frontend
   `OrcamentoPage.tsx`, `api/orcamentos.ts`, hooks, barra orçado-vs-realizado em
   `DashboardsPage.tsx`, aba "Orçamento". Testes de "subcategoria em uso" reescritos pra usar
   `CategorizationRule` em vez de Orçamento como bloqueador (o mecanismo que estava sendo removido
   era o próprio dado de teste usado nesses casos).
2. **Fases 1-2 — Engine da Mesa de Planejamento**: módulo `app/planejamento/` novo (`service.py`,
   `router.py`), models `PlanejamentoValor`/`ItemPlanejado`, migration `0023`. Decisão de execução
   não detalhada no plano: como o schema não guarda `tipo` (débito/crédito) por subcategoria, o
   `tipo` de cada linha da grade é decidido pelo maior volume histórico de transação real
   (`_tipo_dominante`) — subcategoria `fixa`/`variavel` sem nenhuma transação real fica de fora da
   grade automática (sem histórico, sem como decidir o sentido do alerta), documentado no
   docstring da função e coberto por teste (`test_subcategoria_fixa_sem_nenhuma_transacao_real_nao_aparece`).
   Testes: 32 novos (`test_planejamento_service.py`, `test_planejamento_endpoints.py`).
3. **Fase 3 — Design**: dado real extraído do endpoint `GET /planejamento/grade` rodando a engine
   contra a conta demo localmente (seed + itens de exemplo, sem precisar subir servidor). Duas
   candidatas publicadas via Artifact (Candidata A: itens planejados como linhas da própria grade,
   alerta por cor; Candidata B: painel separado, alerta por pastilha). CEO aprovou a Candidata A com
   um acréscimo: linha de Total por seção — Artifact atualizado com o acréscimo antes de seguir pra
   Fase 4.
4. **Fase 4 — Frontend**: `PlanejamentoPage.tsx`, `api/planejamento.ts` + 8 hooks, aba
   "Planejamento" em `ProtectedPage.tsx` na mesma posição de "Orçamento", CSS `.planejamento-*` em
   `index.css` reaproveitando só tokens `--ac-*`. `PlanejamentoPage.test.tsx` novo (7 testes:
   16 colunas, indicador de alerta, confirmar sugestão inline, criar/editar/excluir item
   planejado, vincular/desvincular).
5. Commit 1 (Fase 0-2, backend) → push → **CI falhou** no job Frontend (`npm run format` — Prettier
   nunca tinha sido rodado localmente antes do push, só `tsc`/`eslint`/`vitest`) → `prettier --write`
   nos 4 arquivos tocados → commit 2 (style) → push → CI verde nos 3 jobs (backend/frontend/build-push).
6. Deploy na VM de dev: antes de aplicar a migration `0022` (que derruba a tabela `orcamentos` sem
   preservar dado), checagem explícita pedida pelo próprio plano — `SELECT count(*) FROM
   orcamentos` na VM voltou 3 linhas. Investigado: as 3 linhas batiam exatamente com o fixture do
   seed da conta demo (`_seed_orcamentos`, removido nesta sprint) e pertenciam só ao usuário
   `demo@financeiro.local` (`is_demo=true`) — nenhum dos 3 usuários reais (`daniellimabr`,
   `felipeaesposito`, `gustavo.ismerio`) tinha linha. Premissa do plano ("sem uso real") confirmada,
   migration aplicada.
7. `git pull` + `docker compose pull` + `docker compose run --rm api alembic upgrade head` (0021→
   0022→0023) + `docker compose up -d api frontend` — todos `healthy`.
8. Commit 3 (Fase 4, frontend) → push → **CI falhou de novo no mesmo motivo** (Prettier não rodado
   nos arquivos novos da Fase 4) → `prettier --write` → verde.
9. Doc-updater (subagente) atualizou `roadmap.md`/`directory-structure.md`/
   `dashboards-guia-cards.md`/`DESIGN.md` em paralelo ao deploy. **Revisão manual encontrou vários
   erros reais no output do subagente** (ver "Achados do browser-check e da execução", item 1) —
   corrigidos antes do commit 4 (docs).
10. `scripts/browser-check/check-sprint38.mjs` (novo) rodado contra a VM de dev, logado como o
    usuário sentinela da conta demo (token gerado via `create_access_token` dentro do container
    `api`, sem depender do login pessoal do CEO). **1ª rodada falhou**: grade nunca saía de
    "Carregando..." (ver item 2). Causa raiz encontrada e corrigida (`Caddyfile`), redeploy do
    Caddy, 2ª rodada com timing ajustado — 3 combinações (desktop claro/escuro, mobile claro) 100%
    verdes, sem erro de console.
11. Vínculo item planejado ↔ transação real (o "maior risco da sprint" nomeado no plano) verificado
    ponta a ponta via chamada direta aos endpoints contra a VM (criar item → vincular a uma
    transação real da conta demo → confirmar `transacao_vinculada_id` → desvincular → excluir) —
    não coberto pelo `check-sprint38.mjs` em si (rodar o picker de busca de transação via Playwright
    ficou fora do escopo do script desta vez), mas exercita exatamente o mesmo caminho de código do
    botão "Vincular" da UI.
12. Limpeza: 7 itens de teste ("QA Sprint 38 ...") acumulados nas tentativas com falha do
    browser-check excluídos da conta demo via API.
13. Commit 4 (docs, já com as correções da revisão do item 9) → push.
14. Commit 5 (`fix(infra)`: `Caddyfile` — ver "Achados do browser-check e da execução", item 2) →
    push.
15. Relatório pós-execução (este documento).

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Migration `0022_drop_orcamentos.py` | feito | Checagem de dado real na VM antes de aplicar, como o plano pedia explicitamente — 3 linhas encontradas, confirmadas como fixture da conta demo, não bloqueou |
| 2 | Remover model/módulo/rota/dashboards de Orçamento | feito | Testes de "subcategoria em uso" reescritos (ver acima) |
| 3 | Remover `OrcamentoPage`/`api/orcamentos.ts`/hooks/barra/aba | feito | Sem desvio |
| 4 | Model `PlanejamentoValor` + migration `0023` | feito | Sem desvio |
| 5 | `_sugestao_media_3_meses` + `get_grade` | feito | Decisão de execução não coberta pelo plano: `tipo` por linha decidido por `_tipo_dominante` (maior volume histórico); subcategoria sem nenhuma transação real fica fora da grade automática — ver item 2 do sequenciamento |
| 6 | `PUT/DELETE /planejamento/valores/{id}`, `GET /planejamento/grade` | feito | Sem desvio |
| 7 | Testes backend Fase 1 | feito | 32 testes (service + endpoints), superset do previsto no plano |
| 8 | Model `ItemPlanejado` + migration (mesclada na `0023`) | feito | Migration combinada com a #4 num único arquivo (`planejamento_valores` + `itens_planejados`), mais simples que 2 migrations separadas para tabelas que nascem juntas |
| 9 | CRUD de item planejado + vincular/desvincular + merge na grade | feito | Sem desvio |
| 10 | Testes Fase 2 | feito | Incluídos nos 32 testes do item 7 |
| 11 | Rodada de design (Impeccable/Artifact) | feito, com acréscimo pedido pelo CEO | Linha de Total por seção, fora do que as candidatas originais mostravam — Artifact atualizado antes de fechar a Fase 3 |
| 12 | `api/planejamento.ts` + 8 hooks | feito | Sem desvio |
| 13 | `PlanejamentoPage.tsx` | feito | Sem desvio |
| 14 | Aba "Planejamento" em `ProtectedPage.tsx` | feito | Sem desvio |
| 15 | Testes frontend (`PlanejamentoPage.test.tsx`) | feito | 7 testes: grade 16 colunas, indicador de alerta, confirmar sugestão, CRUD de item, vincular/desvincular |
| 16 | QA visual real (`check-sprint38.mjs`) | feito, em 2 rodadas | 1ª rodada expôs o achado do `Caddyfile` (ver abaixo); vínculo com transação real verificado à parte, via API direta, não pelo script Playwright |
| 17 | Docs (`roadmap.md`, `directory-structure.md`, `dashboards-guia-cards.md`, `DESIGN.md`) | feito, com correção manual pós-subagente | Ver "Achados do browser-check e da execução", item 1 |
| 18 | Relatório de sprint | feito | Este documento |

## Achados do browser-check e da execução (2 problemas reais, não capturados pelos testes automatizados)

1. **Doc-updater (subagente) inventou nomes de arquivo/função que não existem.** Ao delegar a
   atualização de `directory-structure.md` para o subagente `doc-updater`, o resultado listou hooks
   como `useUpdatePlanejamentoValor.ts`/`useDeletePlanejamentoValor.ts`/
   `useListItemsPlanejados.ts`/`useVincularTransacao.ts`/`useDesvincularTransacao.ts` — nenhum
   desses arquivos existe; os nomes reais são `useConfirmarPlanejamentoValor.ts`/
   `useRemoverPlanejamentoValor.ts`/`useItensPlanejados.ts`/`useVincularItemPlanejado.ts`/
   `useDesvincularItemPlanejado.ts`. Também: marcou a Sprint 38 com "✅ ... concluída" em
   `roadmap.md` antes de qualquer aprovação do CEO (inconsistente com a política do projeto — só
   sprints aprovadas ganham ✅) e subiu o contador de auditoria estrutural para 9/5 contando uma
   sprint não aprovada. Em `dashboards-guia-cards.md`/`DESIGN.md`, inventou detalhes de UI que não
   existem (botões "Confirmar"/"Limpar" em vez de "Salvar"/"Cancelar", símbolos ▲/▼ que a
   implementação real não usa — só cor —, "ordem editável por arraste" nos itens planejados, que
   nunca foi construído). **Todos os achados foram revisados e corrigidos manualmente (`git diff`
   linha a linha) antes do commit de docs** — nenhum desses erros chegou a ser commitado.
2. **`Caddyfile` não tinha `/planejamento*` na allowlist do proxy da API.** 1ª rodada do
   `check-sprint38.mjs` contra a VM: nav e "Itens planejados" carregavam, mas a grade ficava presa
   em "Carregando..." pra sempre, sem erro de console. Causa raiz: `@api path` no `Caddyfile` lista
   prefixos de rota explicitamente (`/dashboards* /investimentos* /orcamentos* ...`), e
   `/planejamento*` nunca foi adicionado — a chamada caía no fallback do frontend (SPA), que
   respondia `200 text/html` em vez de erro, silenciosamente. `curl` direto na VM confirmou:
   `Content-Type: text/html`, `Server: nginx` (era o frontend respondendo, não a API). Corrigido
   (`/orcamentos*` trocado por `/planejamento*`), mas **`docker compose exec caddy caddy reload`
   não aplicou a mudança** (Caddy continuou servindo a config antiga) — só um `docker compose
   restart caddy` completo fez o container reler o `Caddyfile` montado via bind mount. Redeploy
   confirmado por `curl` retornando `401` (API real) em vez de `200 text/html` (frontend) antes de
   rodar o browser-check de novo.

Nenhum outro erro de console nas 3 combinações capturadas (desktop claro/escuro, mobile claro).
Screenshots em `scripts/browser-check/shots/sprint38-*.png` (gitignored, dado sintético).

## Evidência de testes

Backend:

```
688 passed, 99% coverage
```

`app/planejamento/service.py` e `app/planejamento/router.py` em 100% de cobertura. `ruff check .` e
`ruff format --check .` limpos.

Frontend:

```
Test Files  32 passed (32)
     Tests  295 passed (295)
```

`npx tsc -b` limpo (mesmo comando do CI). `npx eslint .`: 0 erros, 3 warnings pré-existentes
(`react-refresh/only-export-components`, nenhum novo). `npx prettier --check .` limpo — só depois
de 2 rodadas de `--write` (ver "Sequenciamento real da execução", achado não antecipado: o comando
local de verificação usado durante a implementação não incluía o passo de Prettier que o CI roda
separadamente).

## Critérios de aceite do PRD — verificação item a item

| # | Critério | Atendido? | Evidência |
|---|---|---|---|
| 1 | Nenhuma rota/tabela/componente/teste/item de menu de Orçamento permanece | sim | `grep` por "orcamento"/"Orçamento" no código pós-Fase 0 só retorna a migration histórica `0019` (não apagada, de propósito) e referências narrativas em docs de sprints passadas; browser-check confirma "Orçamento" ausente do nav ao vivo na VM |
| 2 | Grade com subcategorias fixa/variável (despesa e receita) + 3 histórico/atual/12 futuros | sim | `test_get_grade_returns_subcategorias_fixa_variavel`; browser-check: 17 colunas de cabeçalho confirmadas na VM |
| 3 | Mês futuro sem confirmação mostra sugestão, visualmente distinta de confirmado | sim | `test_celula_futura_sem_override_e_sugerida_e_recalcula_com_historico`; visual: pill âmbar tracejada (sugerido) vs. texto sólido (confirmado), ver Artifact aprovado |
| 4 | Confirmar/editar persiste e sobrevive a nova consulta | sim | `test_confirmar_valor_persiste_e_sobrevive_a_nova_consulta`; testado ao vivo na VM (célula "Comer fora" confirmada, visível no screenshot `sprint38-grade-desktop-escuro.png`) |
| 5 | Mês corrente: planejado + realizado-até-agora + indicador dentro/excedido | sim | `test_status_mes_corrente_despesa_excedido_e_dentro`/`_receita_...`; browser-check: "Combustível" mostrou alerta vermelho ao vivo (realizado > sugerido) |
| 6 | Item planejado (único/recorrente) aparece no(s) mês(es) certo(s) mesmo sem histórico | sim | `test_item_planejado_unico_aparece_so_no_mes_alvo`, `test_item_planejado_recorrente_capado_pelo_horizonte` |
| 7 | Item vinculado a transação real vira "cumprido", link pra transação, sai de hipotético | sim | `test_item_planejado_cumprido_para_de_contar_como_hipotetico`; verificado ao vivo via API contra transação real da conta demo (ver "Sequenciamento real da execução", item 11) |
| 8 | Endpoint de grade sem autenticação/outro usuário → 401/isolado | sim | `test_get_grade_without_cookie_returns_401`, `test_get_grade_isolated_by_user` |
| 9 | CI 100% verde, cobertura ≥80% nos módulos novos | sim | Ver "Evidência de testes" — `app/planejamento` em 100% |

## Desvios de escopo registrados

- **Decisão de `tipo` por subcategoria via `_tipo_dominante`** (não especificada no plano) — ver
  item 2 do sequenciamento. Consequência: uma subcategoria `fixa`/`variavel` recém-criada, sem
  nenhuma transação real ainda, não aparece na grade até ter ao menos uma transação categorizada
  nela. Coberto por teste, documentado no docstring da função.
- **Vínculo item↔transação real verificado via API direta, não pelo `check-sprint38.mjs`** — o
  fluxo de busca de transação candidata no picker (seleção de mês/ano na UI) não foi automatizado
  no script Playwright desta sprint por custo/benefício frente ao tempo já gasto; o mecanismo em si
  foi validado ponta a ponta contra dado real da VM por outro caminho (chamada direta aos mesmos
  endpoints que o botão "Vincular" usa).
- **Achado do subagente `doc-updater`** (nomes de arquivo inventados, sprint marcada como aprovada
  prematuramente) — registrado aqui como reforço de que documentação gerada por subagente precisa
  de revisão linha a linha antes do commit, mesmo quando o subagente reporta sucesso. Nenhum erro
  chegou a ser commitado.
- Nenhum item do escopo "fora de escopo" do PRD foi implementado (toggle Modo Projeção no
  Dashboard, abatimento automático de fatura futura de cartão, horizonte configurável além de 12
  meses, mudança em `Natureza`/`NaturezaPage.tsx`, compartilhamento entre os 2 usuários) —
  confirmado por revisão do diff final.

## Deploy

Commits `66387c4` (Fases 0-2), `16a891c` (Fase 4), `d3a85ca` (style: Prettier), `f6c870a` (docs) e
`818a03f` (fix: Caddyfile) — todos com CI verde confirmado (`head_sha` exato, 3 jobs:
backend/frontend/build-push) antes de cada deploy relevante. Estado final:
`api`/`frontend`/`postgres`/`caddy` todos `healthy`/`running` no commit `818a03f` na VM de dev.
Migrations `0022` e `0023` aplicadas via `docker compose run --rm api alembic upgrade head`
(log confirmado: `Running upgrade 0021 -> 0022`, `0022 -> 0023`). `docker compose restart caddy`
necessário (não bastou `reload`) pela mudança no `Caddyfile`.

## Próximos passos

Épico E12 (Planejamento financeiro) aberto, não fechado — só esta sprint até aqui. Candidatos
registrados no roadmap sem sprint numerada: toggle "Modo Projeção" no Dashboard, abatimento de
fatura futura de cartão de crédito como abatimento automático na sugestão. Nenhuma pendência
técnica aberta nesta sprint. Observação para sprint futura (não backlog formal): se o CEO usar a
Mesa de Planejamento na conta real e uma subcategoria `fixa`/`variavel` sem histórico algum
precisar aparecer na grade antes da primeira transação categorizada, revisitar a decisão de
`_tipo_dominante` (hoje documentada como limitação aceita, não como bug).
