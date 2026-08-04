# PRD-001: Fundação técnica

- **Status:** aprovado
- **Épico relacionado:** E1 — [docs/roadmap.md](../roadmap.md)
- **Sprint(s):** [SPRINT-001](../sprints/SPRINT-001-fundacao-tecnica-plan.md)

## Problema

Hoje não existe nenhum código de produto — o repositório está na Fase 0, só documentação
e templates. Sem uma base técnica (backend, frontend, banco, autenticação e um ambiente de
desenvolvimento efetivamente utilizável), nenhuma funcionalidade financeira pode ser
construída.

Essa base esbarra numa restrição real do ambiente: o desenvolvimento é feito num notebook
corporativo com política de segurança restritiva (confirmado em 2026-08-04 — PowerShell em
Constrained Language Mode, sem privilégios de admin, sem winget/choco, WSL2 não instalado).
Docker Desktop, a peça central do ambiente de dev previsto no ADR-001, **não pode ser
instalado localmente**. A Sprint 1 resolve isso adotando uma VM de desenvolvimento na nuvem
como substituta do Docker local, mantendo o restante da stack do ADR-001 intacto.

## Escopo

- **Incluído:**
  - Provisionamento e acesso a uma VM de **dev** (Oracle Cloud Free Tier, instância
    separada da futura VM de prod), acessível via `scripts/ssh_vm.py`/`ssh-vm.ps1`
    (paramiko, dentro de um venv Python).
  - Scaffold backend: FastAPI + SQLAlchemy 2.0 + Alembic + estrutura de testes (pytest),
    rodando via Docker Compose na VM de dev.
  - Scaffold frontend: React + Vite + TypeScript + estrutura de testes (Vitest), rodando
    via Docker Compose na VM de dev.
  - Login via Google OAuth 2.0 (Authlib) ponta a ponta: backend (`/auth/google/login`,
    `/auth/google/callback`, `/auth/me`, sessão JWT em cookie httpOnly) + frontend mínimo
    (botão "Entrar com Google" + página protegida simples que mostra nome/e-mail).
  - Docker Compose (postgres + api) funcionando na VM de dev.
  - Pre-commit: ruff (lint+format Python), eslint+prettier (TS), detect-secrets.
  - CI básico: GitHub Actions rodando pytest+ruff (backend) e vitest+eslint (frontend) a
    cada push/PR.
- **Fora de escopo (explicitamente):**
  - Provisionamento/deploy da VM de **produção** (sprint futura, mediante aprovação do
    CEO).
  - Qualquer schema de domínio financeiro (categorias, contas, transações) — Sprint 2/E4.
  - Sync Pluggy — Sprint 3/E2.
  - Multiusuário avançado (convite, troca de conta, gestão de usuários) — E7.
  - Refresh token / renovação silenciosa de sessão.

## Critérios de aceite

1. Dado que a VM de dev foi provisionada, quando rodo `scripts\ssh-vm.ps1 dev "docker
   compose up -d"`, então API (FastAPI) e Postgres sobem lá e a API responde num endpoint
   de health-check.
2. Dado que não estou autenticado, quando acesso uma rota protegida da API, então recebo
   401.
3. Dado que abro o IP:porta da VM de dev no navegador e clico "Entrar com Google", quando
   completo o consentimento OAuth, então sou redirecionado de volta autenticado, com um
   cookie JWT httpOnly setado, e vejo a página protegida com meu nome/e-mail.
4. Dado um JWT expirado ou inválido, quando acesso uma rota protegida, então recebo 401 e
   o frontend redireciona para a tela de login.
5. Dado um push ou PR no repositório, quando o CI roda, então lint (ruff/eslint) e testes
   (pytest/vitest) executam automaticamente e o resultado aparece no PR.
6. Dado um commit local, quando tento commitar um secret (ex.: chave de API), então o
   pre-commit hook (detect-secrets) bloqueia o commit.

## Regras de negócio

- Sessão: JWT assinado pelo backend, armazenado em cookie httpOnly + `SameSite=Lax`
  (`Secure` em produção via HTTPS; em dev, sem HTTPS, pode ficar sem `Secure`). Expiração
  ~7 dias; renovação silenciosa fica fora de escopo nesta sprint (expirou, loga de novo).
- Isolamento por usuário: tabela `users` criada nesta sprint (id, `google_sub`, email,
  name, `created_at`). Nenhuma tabela transacional ainda existe, mas o padrão de FK
  `user_id` obrigatório em toda tabela futura já fica documentado no OVERVIEW.md.
- Único provedor de autenticação é Google — sem sistema de senha próprio (decisão fixa do
  ADR-001).

## Dados e modelo

- Tabela `users`: `id` (PK), `google_sub` (unique), `email` (unique), `name`,
  `created_at`, `updated_at`.
- Migration inicial via Alembic (`alembic init`, primeira revision criando `users`).
- Sem outras tabelas nesta sprint.

## Segurança

- Isolamento de dados por usuário: ainda não aplicável a dados transacionais (não
  existem); login já isola por `google_sub`/`email` únicos.
- Secrets/credenciais envolvidas: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `JWT_SECRET_KEY`, `DATABASE_URL` — todos via variáveis de ambiente na VM de dev (nunca
  commitados; `.env.example` com placeholders no repo). detect-secrets no pre-commit como
  rede de segurança adicional.
- CEO precisa criar um projeto no Google Cloud Console e configurar a tela de consentimento
  OAuth + credenciais (Client ID/Secret) com redirect URI apontando para o IP:porta da VM
  de dev antes que o login possa ser testado ponta a ponta — tarefa não delegável ao CTO.
- A VM de dev fica com a security list/NSG restrita ao IP público do CEO (não exposta a
  `0.0.0.0/0`). O DNS único do projeto continua reservado só para a VM de **prod**.
- Autonomia de SSH sem aprovação por comando (ver [ssh-workflow.md](../infra/ssh-workflow.md))
  é exclusiva da VM de dev — nunca se estende à VM de prod, mesmo usando o mesmo script.

## Fora de escopo / decisões adiadas

- Provisionamento e deploy da VM de produção: adiado para uma sprint futura, sob aprovação
  explícita do CEO.
- Refresh token / renovação silenciosa de sessão: adiado — login expira, usuário loga de
  novo.
- Multiusuário avançado (convite, troca de conta): E7.

## Referências

- [docs/roadmap.md](../roadmap.md) (E1)
- [ADR-001 — Stack](../architecture/adr/ADR-001-stack.md)
- [ADR-002 — Plugins](../architecture/adr/ADR-002-plugins.md) (gate do Impeccable na
  primeira UI real, tarefa 9 do plano de sprint)
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md)
- [docs/infra/ssh-workflow.md](../infra/ssh-workflow.md) (reescrito em 2026-08-04: duas
  VMs, paramiko, autonomia dev/prod)
