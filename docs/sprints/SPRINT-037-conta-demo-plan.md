# SPRINT-037: Conta Demo (acesso restrito + massa de dados) — Plano

- **PRD(s):** [PRD-037-conta-demo.md](../prd/PRD-037-conta-demo.md)
- **Data do plano:** 2026-09-03

## Objetivo da sprint

Criar um mecanismo de acesso a uma conta demo (usuário fake, sem OAuth próprio), só alcançável a
partir da sessão real de `daniellimabr@gmail.com` via um botão escondido em Configurações, e popular
essa conta com ~9 meses de dado sintético suficiente pra navegar por todas as telas do app —
Dashboards, Categorização (com fila de pendências real), Ativos, Passivos, Investimentos, Orçamento e
Natureza.

Auditoria estrutural: contador seguia em 7/5 sprints desde a última verificação (Sprint 34, adiado
por decisão explícita do CEO, sem reabrir sem provocação dele) — não é assunto desta sprint, só
registrar a contagem atualizada ao fechar (agora 8/5, ainda sob a mesma decisão de adiamento).

## Sequenciamento

1. Schema + config primeiro (migration `0021`, `demo_allowed_email`) — tudo depende disso.
2. Módulo `app/demo/` (get-or-create, gerador de dado, reset) construído e testado isoladamente
   contra o banco de teste antes de ligar o router.
3. Router + `Caddyfile` — endpoint exposto e roteável.
4. Frontend (painel Configurações + banner) por cima do backend já funcional.
5. Browser-check em sessão real (VM de dev) só depois de tudo integrado.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 1 | Migration `0021`: `users.is_demo boolean not null default false` (reversível) | Sonnet: implementação | `backend/alembic/versions/0020_confirmacao_manual_vinculos_transacao.py` (modelo mais recente) |
| 2 | `backend/app/config.py`: `demo_allowed_email: str = "daniellimabr@gmail.com"`; `backend/app/models/user.py`: coluna `is_demo`; `backend/app/schemas/user.py` (`UserOut`): `+ is_demo` | Sonnet: implementação | `config.py`, `models/user.py`, `schemas/user.py` |
| 3 | `backend/app/demo/seed.py`: `seed_demo_data(db, user)` — gerador de ~9 meses de dado sintético (contas fake, transações, regras de categorização, ativos/passivos, investimentos, orçamento) descrito em PRD-037 §Dados e modelo; reaproveita `seed_categories_for_user` e `app/categorization/competencia.py` | Sonnet: implementação | `app/categories/seed.py`, `app/categorization/competencia.py`, `app/models/pluggy.py`, `app/models/asset.py`, `app/models/liability.py`, `app/models/investimento.py`, `app/models/orcamento.py` |
| 4 | `backend/app/demo/service.py`: `get_or_create_demo_user(db)` (cria + chama seed na primeira vez) e `reset_demo_data(db)` (delete direto em ordem de dependência + reseed — não reaproveita `delete_asset`/`delete_liability`) | Sonnet: implementação | `app/auth/service.py::upsert_user_from_google` (padrão de criação de usuário) |
| 5 | `backend/app/demo/router.py`: `GET /demo/enter` (checagem de e-mail, get-or-create, `create_access_token`, `Set-Cookie` + `RedirectResponse`, mirror de `google_callback`) e `POST /demo/reset` (checagem de e-mail + `reset_demo_data`, `204`); registrar router em `app/main.py` | Sonnet: implementação | `app/auth/router.py::google_callback`, `app/auth/deps.py::get_current_user` |
| 6 | `Caddyfile`: adicionar `/demo*` ao matcher `@api` | Sonnet: implementação | `Caddyfile`, gotcha documentado em `docs/architecture/OVERVIEW.md` |
| 7 | `backend/scripts/seed_demo_account.py`: script CLI fino reaproveitando `get_or_create_demo_user`/`seed_demo_data` | Sonnet: implementação | `backend/scripts/import_legacy_categorization_rules.py` (padrão de script CLI) |
| 8 | Testes backend: `test_demo_router.py` (403 pra outro usuário/anônimo, 200+cookie novo pra e-mail permitido, idempotência do get-or-create), `test_demo_seed.py` (contagem mínima por entidade gerada, isolamento por `user_id`, reset não deixa lixo órfão) | Sonnet: implementação | `backend/tests/` (padrão de testes de outros módulos, ex. `test_asset_endpoints.py`) |
| 9 | `frontend/src/api/auth.ts`: `CurrentUser.is_demo: boolean`; novo `frontend/src/api/demo.ts` (`enterDemoUrl` constante, `resetDemoAccount()`); hook `useResetDemoAccount` | Sonnet: implementação | `api/auth.ts`, padrão de hooks de mutation existentes (`useDeleteAsset`) |
| 10 | `frontend/src/pages/ConfiguracoesPage.tsx`: painel "Modo Demo" (visível só se `user.email === "daniellimabr@gmail.com"`) com botões "Entrar no modo demo" e "Resetar dados demo" (`window.confirm` antes) | Sonnet: implementação | `ConfiguracoesPage.tsx` (estrutura de painel `.ac-panel` já usada nas seções existentes) |
| 11 | `frontend/src/pages/ProtectedPage.tsx`: banner "MODO DEMO" quando `user.is_demo`, botão "Sair do modo demo" reaproveitando `useLogout` | Sonnet: implementação | `ProtectedPage.tsx`, `hooks/useLogout.ts` |
| 12 | Testes frontend: `ConfiguracoesPage.test.tsx` (painel só aparece pro e-mail certo, botões disparam as chamadas certas), `ProtectedPage.test.tsx` (banner condicional) | Sonnet: implementação | arquivos de teste correspondentes |
| 13 | Rodar `npm run lint`, `npm run format`, `npx tsc -b`, `npm test`, `npm run test:coverage` (frontend) e `pytest`/cobertura (backend) — suíte 100% verde, cobertura ≥80% em `app/demo/` | Sonnet: implementação | CI (`.github/workflows/ci.yml`) |
| 14 | Deploy na VM de dev (`git push` → CI → `git pull`/`docker compose pull`/`up -d` na VM, `docker compose restart caddy` por causa da mudança no `Caddyfile`) | Sonnet: implementação (SSH VM dev) | `docs/architecture/OVERVIEW.md` §Ciclo de deploy |
| 15 | Popular a conta demo pela primeira vez (`GET /demo/enter` real ou `seed_demo_account.py` via SSH) | Sonnet: implementação (SSH VM dev) | `scripts/ssh-vm.ps1`, `docs/infra/ssh-workflow.md` |
| 16 | Browser-check (`scripts/browser-check/check-demo.mjs`, novo): login real do CEO → "Entrar no modo demo" → confirmar dado renderizado em Dashboards/Categorização/Ativos/Passivos/Investimentos/Orçamento/Natureza → "Sair do modo demo" → login de volta na conta real | Sonnet: implementação (SSH VM dev) | `scripts/browser-check/`, `docs/infra/ssh-workflow.md` |
| 17 | Relatório pós-sprint (`SPRINT-037-conta-demo-report.md`) | Sonnet: implementação | — |

## Coerência de Design (DESIGN.md)

Painel novo em Configurações e banner novo em `ProtectedPage` usam exclusivamente tokens/classes
`.ac-*` já existentes (`.ac-panel`, `.ac-btn`, `.ac-btn-primary`) — sem componente visual novo, sem
decisão de design a reabrir. O banner "MODO DEMO" é o único elemento genuinamente novo; usar o mesmo
vocabulário de alerta/badge já estabelecido no sistema (cor de destaque, não inventar token novo) —
decisão de execução, não de produto.

## Testes previstos

- Backend: isolamento e autorização do endpoint (`403`/`401` pros casos negativos, `200`+cookie novo
  pro caso positivo); idempotência de `get_or_create_demo_user`; `reset_demo_data` realmente limpa
  (sem duplicar linhas numa segunda chamada) e não toca `user_id` de ninguém além do demo; gerador
  cobrindo contagem mínima por entidade (não valores exatos, dado é sintético e pode mudar).
- Frontend: painel "Modo Demo" só renderiza pro e-mail certo; banner "MODO DEMO" só renderiza quando
  `is_demo`; botão de reset dispara a mutation certa e respeita confirmação.
- Cobertura ≥80% em `app/demo/` (novo); suíte 100% verde antes do browser-check.

## Impacto no roadmap

Abre o épico E11 — Conta demo (`docs/roadmap.md`), sem trabalho anterior. `doc-updater` registra o
épico, a entrada da Sprint 37 e atualiza a contagem de auditoria estrutural (8/5 sprints desde a
Sprint 34, ainda sob decisão do CEO de não reabrir sem provocação dele) ao final, junto do relatório
pós-execução.

## Riscos / dependências

- **Volume/realismo do dado sintético é o maior risco de execução** — a lista de entidades no PRD é
  um alvo, não uma receita exata; se alguma tela ficar visivelmente vazia ou com dado implausível
  durante o browser-check, ajustar o gerador antes de fechar a sprint, não deixar como pendência.
- **Sobrescrever o cookie de sessão troca a sessão real do CEO** — comportamento aceito e decidido
  explicitamente nesta sessão de planejamento (ver PRD-037 §Decisão do CEO), mas é a única forma desta
  sprint de "sair" da conta real sem querer é clicar sem querer no botão; mitigado por ele ficar
  escondido atrás da checagem de e-mail e por exigir confirmação (`window.confirm`) só no reset, não
  na entrada — considerar na execução se "Entrar no modo demo" também merece confirmação, já que troca
  a sessão ativa.
- **`reset_demo_data` não pode reaproveitar os `delete_*` guardados** (`delete_asset`/
  `delete_liability` são pensados pra uso interativo item a item, com desassociação de FK) — precisa
  de rotina própria em ordem de dependência; risco de esquecer uma tabela e deixar lixo órfão,
  mitigado pelo teste de "reset não deixa lixo órfão" (tarefa 8).
- **Nunca chamar a Pluggy real para a conta demo** — todo dado é sintético, gerado direto no banco;
  risco de alguém reaproveitar sem querer uma função do `pluggy_integration` que dispara chamada real
  — o gerador deve inserir modelos diretamente via SQLAlchemy, nunca via `sync_item`/`PluggyClient`.
- Deploy segue o fluxo padrão do projeto (relatório → aprovação do CEO → deploy manual na VM de dev),
  não incluído nesta sprint até o relatório ser aprovado — mas como a tarefa 15/16 exige popular e
  validar a conta demo de verdade, o deploy real na VM de dev é pré-requisito de fechar a sprint
  (mesmo padrão de sprints anteriores com QA visual real).
