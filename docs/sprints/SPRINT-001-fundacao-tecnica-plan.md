# SPRINT-001: Fundação técnica — Plano

- **PRD(s):** [PRD-001-fundacao-tecnica](../prd/PRD-001-fundacao-tecnica.md)
- **Data do plano:** 2026-08-04

## Objetivo da sprint

Ao final, existe uma VM de dev funcional (Docker Compose com API+Postgres, acessível via
SSH automatizado sem fricção) com login Google funcionando ponta a ponta e uma esteira de
qualidade (lint, testes, pre-commit, CI) pronta para todas as sprints seguintes.

## Tarefas

| # | Tarefa | Subagente/modelo | Arquivos/docs de contexto |
|---|---|---|---|
| 0 | **CEO:** provisionar a VM de dev no Oracle Cloud (instância separada da futura VM de prod), gerar par de chaves SSH, definir portas customizadas (SSH + preview web), restringir security list ao IP do CEO, repassar host/porta/chave via env vars `FINANCEIRO_DEV_VM_*`. Bloqueante de qualquer tarefa que execute algo remotamente. | CEO | [ssh-workflow.md](../infra/ssh-workflow.md) |
| 1 | Escrever `scripts/ssh_vm.py` (paramiko) + `requirements-ssh.txt` + atualizar `ssh-vm.ps1` | Sonnet: implementação | [ssh-workflow.md](../infra/ssh-workflow.md) — **já entregue nesta sessão de planejamento** |
| 2 | Reescrever `docs/infra/ssh-workflow.md` e atualizar `CLAUDE.md` (política de autonomia dev/prod) | Sonnet: implementação | CLAUDE.md — **já entregue nesta sessão de planejamento** |
| 3 | **CEO:** criar projeto Google Cloud Console + credenciais OAuth + tela de consentimento, com redirect URI apontando para o IP:porta da VM de dev | CEO | PRD-001 §Segurança |
| 4 | Scaffold backend (FastAPI, estrutura `app/`+`tests/`, `pyproject.toml`, dependências), rodando via Docker Compose na VM de dev. Código editado localmente, sincronizado via `git push`/`git pull`, comandos executados via `ssh_vm.py dev` | Sonnet: implementação | [ADR-001](../architecture/adr/ADR-001-stack.md) |
| 5 | Alembic + migration inicial (tabela `users`) | Sonnet: implementação | PRD-001 §Dados e modelo |
| 6 | Endpoints de auth (`/auth/google/login`, `/auth/google/callback`, `/auth/me` + dependency de validação JWT) | Sonnet: implementação | PRD-001 §Regras de negócio / §Segurança |
| 7 | Testes backend de auth (JWT válido/expirado/inválido, criação/atualização de usuário com Google mockado), rodados na VM de dev via `ssh_vm.py dev "pytest ..."` | Sonnet + skill tdd-workflow | PRD-001 §Critérios de aceite |
| 8 | Scaffold frontend (Vite+React+TS, TanStack Query, ESLint+Prettier, Vitest+Testing Library) | Sonnet: implementação | [ADR-001](../architecture/adr/ADR-001-stack.md) |
| 9 | Frontend: página de login + página protegida + tratamento de 401. Validar abrindo `http://<ip-dev>:<porta>` num navegador; rodar `/impeccable audit` (primeira UI real do projeto) | Sonnet: implementação | PRD-001 §Critérios de aceite; [ADR-002](../architecture/adr/ADR-002-plugins.md) |
| 10 | Docker Compose na VM de dev (`docker-compose.yml`, `Dockerfile` backend, `.env.example`) | Sonnet: implementação | [ADR-001](../architecture/adr/ADR-001-stack.md) |
| 11 | Pre-commit (ruff, eslint, detect-secrets + baseline inicial) — roda local no notebook, não depende da VM | Sonnet: implementação | ADR-001 |
| 12 | CI (`.github/workflows/ci.yml`: pytest+ruff, vitest+eslint) — roda em runner do GitHub, não depende da VM de dev nem do notebook | Sonnet: implementação | ADR-001 |
| 13 | Atualizar docs vivos (`directory-structure.md`, `OVERVIEW.md` — registrar a VM de dev, o fluxo git-sync + SSH, e a topologia de portas/DNS) | Haiku: doc-updater | OVERVIEW.md, directory-structure.md |
| 14 | Relatório de sprint | Haiku: doc-updater | [SPRINT-report-template.md](../../templates/SPRINT-report-template.md) |

## Testes previstos

- **Unitários (pytest):** validação de JWT (válido, expirado, assinatura inválida),
  criação/atualização de usuário a partir de dados do Google (usuário novo vs existente),
  dependency de auth negando acesso sem cookie.
- **Integração:** `/auth/google/callback` com Google mockado (nunca bater na API real do
  Google em teste), `/auth/me` com e sem cookie válido, endpoint de health-check.
- **Frontend (Vitest):** renderização condicional login vs página protegida, tratamento de
  401.
- Todos executados na VM de dev via `scripts/ssh-vm.ps1 dev "..."`. Cobertura ≥80% não é
  hard gate geral ainda (pouca lógica de negócio real nesta sprint), mas o código de auth
  deve ficar perto de 100% por ser código de segurança.

## Impacto no roadmap

Fecha o épico E1 por completo. Desbloqueia E4 (Sprint 2 — schema de categorias/ativos,
que só precisa do banco existir) e E8 (import legado, pode rodar assim que houver schema).
Introduz a **VM de dev** como peça permanente da infraestrutura do projeto — não estava no
roadmap original, adicionada durante o planejamento desta sprint por causa da restrição do
notebook corporativo.

## Riscos / dependências

- Provisionamento da VM de dev depende do CEO (Oracle Cloud console, fora do alcance do
  CTO) — bloqueia as tarefas 4-10 (tudo que precisa executar algo remotamente); tarefas
  1, 2, 11 e 12 podem rodar em paralelo.
- Latência de iteração: cada ciclo de teste é `git push` + `git pull` + execução via SSH,
  mais lento que rodar local. Aceito como trade-off da restrição do notebook.
- VM de dev fica exposta à internet (com security list restrita ao IP do CEO) — se o IP do
  CEO mudar, a regra precisa ser atualizada antes do acesso voltar a funcionar.
- A autonomia de SSH sem aprovação por comando é exclusiva da VM de dev; **nunca** deve ser
  reaproveitada para a VM de prod, mesmo usando o mesmo script (`ssh_vm.py`).
- Credenciais Google do CEO (tarefa 3) podem atrasar as tarefas 6, 7 e 9 (parte que
  depende de auth real); o resto do scaffold segue em paralelo.
- Escolha entre `pyjwt`/`python-jose` para assinar o JWT é decisão de implementação, não
  arquitetural — pode ser feita durante a execução sem novo ADR.
