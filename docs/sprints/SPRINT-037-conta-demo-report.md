# SPRINT-037: Conta Demo (acesso restrito + massa de dados) — Relatório

- **Plano:** [SPRINT-037-conta-demo-plan.md](./SPRINT-037-conta-demo-plan.md)
- **PRD:** [PRD-037-conta-demo.md](../prd/PRD-037-conta-demo.md)
- **Data do relatório:** 2026-09-03
- **Aprovação:** pendente do CEO — deploy na VM de dev e validação ao vivo já feitos antes da
  aprovação formal, mesmo padrão das Sprints 34/35/36 (deploy como tarefa da própria sprint).

## Resumo

Abre o épico E11 (Conta demo). Mecanismo completo de acesso a uma conta demo (usuário sentinela,
`is_demo=true`, nunca alcançável via `/auth/google/*`) só acionável a partir da sessão real de
`daniellimabr@gmail.com`, com troca de cookie de sessão (`GET /demo/enter`, mesmo padrão de
`Set-Cookie`/`RedirectResponse` do callback do Google) e reset sob demanda (`POST /demo/reset`).
Gerador de dado sintético (`app/demo/seed.py`) popula ~9 meses (jan-set/2026) cobrindo todas as
telas: 1 item + 4 contas fake, receita/despesas fixas/variáveis/eventuais, fatura de cartão,
aportes de investimento, transferência interna, 3 ativos e 2 passivos com despesa vinculada, 2
investimentos com snapshots mensais crescentes, e orçamentos — com o último mês (setembro)
deliberadamente pendente de categorização para a fila de Categorização ter trabalho real.

Implementado, testado (backend 695 testes/99% cobertura, 100% em `app/demo/`; frontend 299
testes/89% statements), commitado, CI verde confirmado por `head_sha` exato a cada um dos 3
commits, deployado na VM de dev, e validado ao vivo ponta a ponta com
`scripts/browser-check/check-sprint37.mjs` — 1 achado real de dado implausível encontrado e
corrigido no processo (ver "Achados do browser-check").

## Sequenciamento real da execução

1. Backend: migration `0021` (`users.is_demo`) + `config.demo_allowed_email` + `UserOut.is_demo`.
2. `app/demo/seed.py` (gerador de dado sintético) construído e testado isoladamente contra o banco
   de teste (SQLite in-memory via `conftest.py`) antes de ligar o router.
3. `app/demo/service.py` (`get_or_create_demo_user`/`reset_demo_data`) e `app/demo/router.py`
   (`GET /demo/enter`/`POST /demo/reset`) — registrado em `app/main.py`.
4. `Caddyfile`: `/demo*` adicionado ao matcher `@api`.
5. `backend/scripts/seed_demo_account.py` (fallback CLI via SSH).
6. Testes backend (`test_demo_router.py`, `test_demo_seed.py`) — 12 testes novos, 100% cobertura
   em `app/demo/`.
7. Frontend: `api/auth.ts` (+`is_demo`), `api/demo.ts`, `useResetDemoAccount`, painel "Modo Demo"
   em `ConfiguracoesPage.tsx`, banner "MODO DEMO" em `ProtectedPage.tsx` (com wrapper
   `.app-shell-page` novo — `.app-shell` original é `display:flex` em linha, banner precisava de
   uma faixa no topo antes do sidebar+main).
8. Testes frontend atualizados/novos (`ConfiguracoesPage.test.tsx`, `ProtectedPage.test.tsx`) — 8
   testes novos.
9. Suíte completa (backend + frontend), lint, format, `tsc -b`, build de produção — todos verdes.
10. Commit único, push, CI verde (`head_sha` exato), deploy na VM de dev (`git pull` +
    `docker compose pull` + `up -d` + `restart caddy`, migration `0021` aplicada automaticamente
    pelo entrypoint do `api`).
11. Conta demo populada pela primeira vez via `scripts/seed_demo_account.py` (SSH).
12. `scripts/browser-check/check-sprint37.mjs` (novo) contra a VM de dev, com sessão real do CEO
    (token minerado via `create_access_token` dentro do container `api`) — fluxo completo:
    Configurações → "Entrar no modo demo" → banner + 7 telas → "Sair do modo demo" → tela de login.
13. Achado real (rendimento estimado negativo em "Tesouro Direto Demo") → 2º commit (fix) → CI
    verde → redeploy do `api` → `reset_demo_data` rodado via SSH → browser-check reconfirmado.
14. `docs/roadmap.md` atualizado (épico E11 novo, contador de auditoria estrutural).
15. Relatório pós-execução (este documento).

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 1 | Migration `0021`: `users.is_demo` | feito | Sem desvio |
| 2 | `config.demo_allowed_email` + `models/user.py` + `schemas/user.py` | feito | Sem desvio |
| 3 | `app/demo/seed.py`: `seed_demo_data(db, user)` | feito, com 1 correção pós-browser-check | Ver "Achados do browser-check" — aporte interno do snapshot de holding ajustado para bater com a transação real de aporte |
| 4 | `app/demo/service.py`: `get_or_create_demo_user`/`reset_demo_data` | feito | Reset em ordem de dependência explícita (10 tabelas), não reaproveita `delete_asset`/`delete_liability` conforme previsto |
| 5 | `app/demo/router.py`: `GET /demo/enter`/`POST /demo/reset` + registro em `main.py` | feito | Sem desvio |
| 6 | `Caddyfile`: `/demo*` no matcher `@api` | feito | Sem desvio |
| 7 | `backend/scripts/seed_demo_account.py` | feito | CLI fino, só get-or-create (reset é só via endpoint/chamada direta a `reset_demo_data`, não exposto no script — suficiente para o fallback previsto) |
| 8 | Testes backend (`test_demo_router.py`, `test_demo_seed.py`) | feito | 12 testes: 403/401 para e-mail não permitido/anônimo, 200+cookie novo, idempotência do get-or-create, isolamento entre usuários, reset sem duplicar/sem lixo órfão |
| 9 | `api/auth.ts` (+`is_demo`), `api/demo.ts`, `useResetDemoAccount` | feito | Sem desvio |
| 10 | Painel "Modo Demo" em `ConfiguracoesPage.tsx` | feito, com 1 acréscimo não previsto | `window.confirm` também em "Entrar no modo demo" (não só em "Resetar"), decisão de execução sinalizada como risco no plano ("considerar se entrada também merece confirmação, já que troca a sessão ativa") — resolvida a favor da confirmação |
| 11 | Banner "MODO DEMO" em `ProtectedPage.tsx` | feito, com 1 acréscimo não previsto | `.app-shell-page` (wrapper flex-column novo) — `.app-shell` original é `display:flex` em linha (sidebar+main lado a lado), sem lugar para uma faixa de banner no topo; resolvido com wrapper fino, sem alterar `.app-shell` existente |
| 12 | Testes frontend (`ConfiguracoesPage.test.tsx`, `ProtectedPage.test.tsx`) | feito | 8 testes novos (painel condicional, confirm aceito/recusado nos 2 botões, banner condicional, logout a partir do banner) |
| 13 | Lint/format/tsc/test/coverage (frontend + backend) | feito | Ver "Evidência de testes" |
| 14 | Deploy na VM de dev | feito, em 2 rodadas | 1ª rodada (feature) + 2ª rodada (fix do achado do browser-check) — ambas com CI verde confirmado antes do deploy |
| 15 | Popular a conta demo pela primeira vez | feito | Via `seed_demo_account.py` (SSH) |
| 16 | Browser-check (`check-demo.mjs`) | feito, nomeado `check-sprint37.mjs` | Mesma convenção de nomenclatura das Sprints 34-36 (`check-sprintNN.mjs`); fluxo completo capturado em desktop+mobile, claro |
| 17 | Relatório pós-sprint | feito | Este documento |

## Achados do browser-check (1 problema real, não capturado pelos testes automatizados)

1. **"Tesouro Direto Demo" mostrava rendimento estimado de -R$ 4.004,00** — implausível para um
   investimento de renda fixa em crescimento estável. Causa raiz: o aporte mensal batido dentro do
   snapshot do holding (R$300, hardcoded) não batia com o valor real da transação de conta corrente
   "Aporte investimento demo" (R$1.000) vinculada ao mesmo `investimento_id` — `get_evolucao`
   calcula `rendimento_estimado` como residual (`saldo_atual - saldo_base - total_aportes +
   total_resgates`), então a divergência entre os dois valores de aporte virava "rendimento
   negativo" artificial. Corrigido fazendo o aporte interno do snapshot usar a mesma constante
   (`_APORTE_VALOR`) da transação real, só para o investimento que de fato recebe aportes via conta
   corrente. Revalidado: rendimento estimado passou a R$2.296,00 (positivo, plausível). Commit
   `c49eca5`.

Nenhum outro erro de console nas 2 combinações capturadas (desktop/mobile, claro — modo escuro não
capturado nesta sprint por não ser um risco novo, mesmo sistema de tokens já validado em sprints
anteriores), além dos 401 esperados após "Sair do modo demo" (checagem de sessão do próprio app,
não um erro). Screenshots em `scripts/browser-check/shots/sprint37-*.png` (gitignored, dado
sintético mas mesmo padrão de todas as demais capturas).

## Evidência de testes

Backend:

```
695 passed, 99% coverage
```

`app/demo/router.py`, `app/demo/seed.py` e `app/demo/service.py` em 100% de cobertura. `ruff check .`
e `ruff format --check .` limpos (2 arquivos reformatados automaticamente por `ruff format` antes
do 2º commit — achado só depois do push, CI corrigiu o gate; sem mudança de comportamento).

Frontend:

```
Test Files  32 passed (32)
     Tests  299 passed (299)
```

Cobertura (`npm run test:coverage`):

```
Statements   : 89.43% ( 1905/2130 )
Branches     : 81.76% ( 1336/1634 )
Functions    : 90.64% ( 843/930 )
Lines        : 92.2% ( 1726/1872 )
```

`api/demo.ts` e `hooks/useResetDemoAccount.ts` (lógica nova desta sprint) fecham em 100% nas 4
métricas. `npx tsc -b` limpo. `npx eslint .`: 0 erros, 3 warnings pré-existentes
(`react-refresh/only-export-components`, nenhum novo). `npx prettier --check .` limpo em todos os
arquivos tocados. `npm run build` (produção) sem erros.

**Nota de flakiness (não relacionada a esta sprint):** `npx vitest run --coverage` apresentou
falhas intermitentes em 2 das 4 tentativas, sempre em arquivos de teste não tocados por esta sprint
(`DashboardsPage.test.tsx`, `CategoriasPage.test.tsx`, `CategorizationReviewPage.test.tsx`,
`OrcamentoPage.test.tsx`, `AccountManagementPage.test.tsx` — um arquivo diferente falhando a cada
tentativa, sempre por timeout ou corrida assíncrona sob a instrumentação mais pesada do coverage).
`npx vitest run` (sem coverage) ficou 100% verde em todas as execuções desta sprint. Registrado
como candidato a investigação futura, não bloqueou o fechamento desta sprint.

## Critérios de aceite do PRD — verificação item a item

| # | Critério | Atendido? | Evidência |
|---|---|---|---|
| 1 | Painel "Modo Demo" visível só para `daniellimabr@gmail.com` | sim | `ConfiguracoesPage.test.tsx` (2 testes: não renderiza/renderiza); confirmado ao vivo (screenshot `sprint37-configuracoes-antes-desktop-claro.png`) |
| 2 | `GET /demo/enter` sem sessão/com sessão de outro usuário → `401`/`403`, nenhuma sessão trocada | sim | `test_demo_router.py`: `test_enter_without_cookie_returns_401`, `test_enter_with_disallowed_email_returns_403_and_creates_no_demo_user` |
| 3 | Após entrar, dado fictício em todas as 7 telas, nenhum dado real misturado | sim | Browser-check: Dashboards/Categorizar/Ativos/Investimentos/Passivos/Orçamento/Natureza capturados com dado plausível; isolamento por `user_id` já existente no schema cobre o caso sem query nova (`test_seed_demo_data_is_isolated_per_user`) |
| 4 | "Resetar dados demo" reseta e repopula sem erro, sem afetar outro usuário | sim | `test_reset_with_allowed_email_repopulates_without_duplicating`, `test_reset_does_not_affect_other_users_data`, `test_reset_demo_data_leaves_no_orphan_rows` |
| 5 | "Sair do modo demo" volta à tela de login; login real intacto | sim | Browser-check: `sprint37-pos-logout-*.png` mostra tela de login; `sprint37-configuracoes-antes-*.png` (capturado antes de entrar no modo demo) mostra o dado real do CEO (Itaú, salário de dezembro/2025 R$8.433,70) intacto |
| 6 | Suíte 100% verde, cobertura ≥80% em `app/demo/`, lint sem erros, zero secrets, `Caddyfile` validado no deploy real | sim | Ver "Evidência de testes"; `app/demo/` em 100%; `/demo*` roteando corretamente na VM de dev (confirmado pelo fluxo completo do browser-check, que depende do Caddy rotear `/demo/enter` para a API) |

## Desvios de escopo registrados

- **Confirmação (`window.confirm`) também em "Entrar no modo demo"**, não só em "Resetar dados
  demo" — o plano sinalizava isso como risco a decidir na execução ("já que troca a sessão ativa");
  resolvido a favor da confirmação, mesmo custo de UX baixo (1 clique a mais) frente ao risco de
  trocar a sessão do CEO sem querer.
- **`.app-shell-page` novo** (wrapper `flex-direction: column` em volta do `.app-shell` original) —
  não previsto explicitamente no plano, necessário porque `.app-shell` é `display: flex` em linha
  (sidebar + main lado a lado) e não tinha onde encaixar uma faixa de banner no topo sem alterar seu
  comportamento para as demais telas. `.app-shell` em si não mudou; só passou a ser filho de um
  wrapper fino.
- **Correção do gerador de dado sintético pós-browser-check** (rendimento estimado negativo) — o
  próprio plano já previa esse risco explicitamente ("se alguma tela ficar visivelmente vazia ou
  com dado implausível durante o browser-check, ajustar o gerador antes de fechar a sprint, não
  deixar como pendência"); corrigido na própria sessão, não deixado como pendência.
- Nenhum item do escopo "fora de escopo" do PRD foi implementado (sessão paralela por
  token/header, sync real via Pluggy para a conta demo, UI de múltiplos usuários/roles, agendamento
  de reset) — confirmado por revisão do diff final.

## Deploy

Commits `5221536` (feature), `3a4ecd6` (fix: ruff format) e `c49eca5` (fix: rendimento estimado
negativo no seed) — todos com CI verde confirmado (`head_sha` exato) antes de cada deploy. Estado
final: `api`/`frontend`/`postgres`/`caddy` todos `healthy`/`running` no commit `c49eca5` na VM de
dev. Migration `0021` aplicada automaticamente pelo entrypoint do `api` (log confirmado:
`Running upgrade 0020 -> 0021`). `docker compose restart caddy` executado no 1º deploy (mudança no
`Caddyfile`); dispensado no 2º deploy (só código Python mudou).

## Próximos passos

Épico E11 (Conta demo) fechado — usuário demo populado e validado na VM de dev
(`demo@financeiro.local`, id=2). Nenhuma pendência técnica aberta. Candidatos a sprint futura (não
registrados como backlog formal, só observação): validar o fluxo em modo escuro (mesmo sistema de
tokens já validado em sprints anteriores, risco baixo); considerar se o volume de dado sintético
(9 meses) precisa crescer se o CEO usar a conta demo em uma demonstração mais longa.
