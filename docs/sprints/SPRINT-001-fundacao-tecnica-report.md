# SPRINT-001: Fundação técnica — Relatório

- **Plano:** [SPRINT-001-fundacao-tecnica-plan.md](./SPRINT-001-fundacao-tecnica-plan.md)
- **PRD:** [PRD-001-fundacao-tecnica](../prd/PRD-001-fundacao-tecnica.md)
- **Data do relatório:** 2026-08-04
- **Status:** aprovado pelo CEO em 2026-08-04

## Resumo

Sprint 1 entregou a base técnica da aplicação: VM de desenvolvimento funcional (Docker Compose com 4 serviços — postgres, API FastAPI, frontend React, Caddy reverse-proxy), autenticação Google OAuth com JWT em cookie httpOnly, tabela `users` via Alembic, testes automatizados (pytest backend 95% cobertura, Vitest frontend), e esteira de qualidade (pre-commit local + CI no GitHub Actions). Login Google validado end-to-end pelo CEO no navegador. Os 6 critérios de aceite do PRD-001 estão confirmados; épico E1 fechado.

## Itens do plano vs. entregue

| # | Tarefa planejada | Status | Desvio/justificativa |
|---|---|---|---|
| 0 | **CEO:** provisionar VM de dev, gerar chaves SSH, definir portas customizadas, restringir security list | **Parcial** | VM provisionada e acessível via SSH (porta 22 padrão, chave gerada); porta SSH customizada não configurada e security list liberada a 0.0.0.0/0 por decisão consciente do CEO (IP público dele muda constantemente) — mitigado com fail2ban + auth só por chave |
| 1 | `scripts/ssh_vm.py` + `requirements-ssh.txt` + `ssh-vm.ps1` | **Feito** | Já entregue em sessão de planejamento (2026-08-04, antes da execução) |
| 2 | Reescrever `docs/infra/ssh-workflow.md` e atualizar `CLAUDE.md` | **Feito** | Já entregue em sessão de planejamento |
| 3 | **CEO:** criar projeto Google Cloud + credenciais OAuth | **Não feito** | Bloqueado — CEO ainda não completou; código de auth pronto e testado com mocks |
| 4 | Scaffold backend (FastAPI, estrutura, Docker) | **Feito** | `backend/`: pyproject.toml, app/main.py, app/config.py, app/db.py, app/models/user.py, app/auth/{jwt.py, google.py, service.py, router.py, deps.py}, tests/, alembic/ |
| 5 | Alembic + migration inicial (`users`) | **Feito** | `backend/alembic/versions/0001_create_users.py` cria tabela com id, google_sub (unique), email (unique), name, created_at, updated_at |
| 6 | Endpoints de auth (`/auth/google/login`, `/auth/google/callback`, `/auth/me`) + dependency JWT | **Feito** | Código implementado, testado com Google mockado; validação end-to-end em navegador pendente (depende de tarefa 3 do CEO) |
| 7 | Testes backend de auth (JWT, upsert usuário, endpoints) | **Feito** | 10 testes passando, cobertura 95% — ver seção "Evidência de testes" abaixo |
| 8 | Scaffold frontend (React 19, Vite, TypeScript, TanStack Query, ESLint, Prettier, Vitest) | **Feito** | `frontend/`: package.json, vite.config.ts, tsconfig.json, src/App.tsx, src/pages/{LoginPage.tsx, ProtectedPage.tsx}, src/api/, src/hooks/, tests/ |
| 9 | Frontend: login + página protegida + tratamento 401; rodar `/impeccable audit` | **Feito** | LoginPage com botão "Entrar com Google", ProtectedPage mostra nome/e-mail, App.tsx renderização condicional login/protected/loading; auditoria: score 19/20, única correção necessária: `<html lang="en">` → `lang="pt-BR"` (corrigido em index.html) |
| 10 | Docker Compose (postgres, api, frontend, caddy) | **Feito** | `docker-compose.yml` com 4 serviços, healthchecks, build stages multi-stage para frontend (Vite + nginx:1.27-alpine), Caddyfile roteamento /auth/* e /health para api, resto para frontend |
| 11 | Pre-commit (ruff, eslint, detect-secrets + baseline) | **Feito** | `.pre-commit-config.yaml` instalado localmente, `.secrets.baseline` gerado, pre-commit install ativo em `.git/hooks/pre-commit` |
| 12 | CI (`.github/workflows/ci.yml`: pytest+ruff backend, vitest+eslint frontend) | **Feito** | Confirmado rodando e verde no GitHub Actions (run [30943852049](https://github.com/daniellimabr/financeiro/actions/runs/30943852049), ambos os jobs `success`); primeira versão do workflow tinha um YAML inválido (`DATABASE_URL: sqlite:///:memory:` sem aspas quebrava o parser) que foi corrigido durante a sprint |
| 13 | Atualizar `directory-structure.md` e `OVERVIEW.md` | **Feito** | directory-structure.md: adicionados backend/, frontend/, docker-compose.yml, Caddyfile, .env.example, .pre-commit-config.yaml, .secrets.baseline, .github/workflows/ci.yml; OVERVIEW.md: VM de dev registrada como permanente, Docker Compose detalhado, fluxo git-sync, topologia Caddy |
| 14 | Relatório de sprint | **Feito** | Este arquivo |

## Evidência de testes

### Backend (pytest, rodado localmente antes do deploy)

```
============================= test session starts =============================
platform win32 -- Python 3.12.0, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Financeiro v3\backend
configfile: pyproject.toml
testpaths: tests
plugins: anyio-4.14.2, cov-7.1.0
collected 10 items

tests\test_auth_endpoints.py ....                                        [ 40%]
tests\test_auth_service.py ..                                            [ 60%]
tests\test_health.py .                                                   [ 70%]
tests\test_jwt.py ...                                                    [100%]

=============================== tests coverage ================================
Name                      Stmts   Miss  Cover   Missing
-------------------------------------------------------
app\__init__.py               0      0   100%
app\auth\__init__.py          0      0   100%
app\auth\deps.py             18      1    94%   24
app\auth\google.py            4      0   100%
app\auth\jwt.py              11      0   100%
app\auth\router.py           28      2    93%   19-20
app\auth\service.py          12      0   100%
app\config.py                14      0   100%
app\db.py                    13      4    69%   17-21
app\main.py                  10      0   100%
app\models\__init__.py        2      0   100%
app\models\user.py           12      0   100%
app\schemas\__init__.py       0      0   100%
app\schemas\user.py           8      0   100%
-------------------------------------------------------
TOTAL                       132      7    95%
======================= 10 passed, 10 warnings in 0.26s =======================
```

Cobertura de lógica de negócio: **95%** (meta ≥80% — superada). `app/db.py` é o único módulo abaixo de 90% (linhas de setup de engine/sessão, sem lógica de negócio).

### Frontend (Vitest + Testing Library, rodado localmente)

```
 RUN  v4.1.10 C:/Financeiro v3/frontend

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  15:16:27
   Duration  3.04s (transform 190ms, setup 338ms, import 272ms, tests 117ms, environment 1.81s)
```

`src/App.test.tsx` cobre os dois cenários exigidos pelo plano: sessão não autenticada (fetch mockado retornando 401 → renderiza LoginPage) e sessão autenticada (fetch mockado retornando 200 com dados do usuário → renderiza ProtectedPage com nome/e-mail).

## Lint/formatter

### Backend (ruff, rodado localmente)

```
$ ruff format app tests alembic
1 file reformatted, 21 files left unchanged

$ ruff check app tests alembic
All checks passed!
```

### Frontend (ESLint + Prettier + tsc, rodado localmente)

```
$ npx tsc -b        → sem output (sucesso, sem erros de tipo)
$ npx eslint .       → sem output (sucesso, zero problemas)
$ npx prettier --check .  → "All matched files use Prettier code style!"
$ npm run build      → tsc -b && vite build — build de produção concluído sem erros
```

## Decisões tomadas durante a execução

1. **Frontend router:** removido `react-router-dom` apesar de estar no plano inicial — Vitest+Testing Library + renderização condicional simples em App.tsx é suficiente para o escopo desta sprint (2 telas, sem necessidade de rotas); stack de router-dom 7.x tem CVEs recorrentes. Reversível em futuro se necessário.

2. **Linter frontend:** ADR-001 fixa ESLint como lint, não oxlint — oxlint veio como default no template Vite mais recente; revertido para ESLint+Prettier conforme ADR.

3. **JWT library:** escolhido PyJWT (não python-jose) por simplicidade e não exigir dependência extra de criptografia; decisão puramente de implementação, não arquitetural, tomada sem necessidade de novo ADR.

4. **Caddy versão:** `caddy:2-alpine` por estabilidade e footprint mínimo em container.

5. **Migration reversível:** Alembic 0001 estruturado com `upgrade()` e `downgrade()` funcional — permite rollback seguro em futuro.

6. **CI quebrado no primeiro push:** o workflow inicial tinha `DATABASE_URL: sqlite:///:memory:` sem aspas, o que o YAML interpreta como um mapeamento aninhado (dois-pontos não escapados) — GitHub Actions falhava antes de sequer agendar um job. Corrigido citando o valor. Placeholders de teste (`JWT_SECRET_KEY`, `GOOGLE_CLIENT_SECRET` no CI) também foram barrados pelo detect-secrets (falso positivo esperado) e marcados com `# pragma: allowlist secret`.

7. **Redirect URI do Google não aceita IP puro:** o Google rejeita `http://<ip>:8080/...` como redirect URI ("é preciso usar um domínio... com TLD válido"). O CEO criou um domínio gratuito no DuckDNS (`financeirov2.duckdns.org` → aponta para o IP da VM de dev) em vez do IP direto. `OAUTH_REDIRECT_BASE_URL` na VM foi atualizado para usar esse domínio; documentado em OVERVIEW.md para as próximas sprints.

8. **Duas camadas de firewall na VM de dev (gotcha da imagem Ubuntu da Oracle):** liberar a porta 8080 só na Security List do Oracle Cloud não bastou — a imagem Ubuntu da Oracle já vem com `iptables` configurado no próprio SO aceitando só a porta 22 e rejeitando o resto (`REJECT ... icmp-host-prohibited`). Foi preciso adicionar uma regra `ACCEPT tcp dpt:8080` no `iptables` da VM também. Documentado em OVERVIEW.md como algo a checar em qualquer porta nova, dev ou prod.

9. **Também havia duas Security Lists na VCN** (uma para a subnet privada, outra "Default" — provavelmente a que a instância pública realmente usa) — a regra da porta 8080 tinha sido criada só na primeira; precisou ser replicada na segunda para funcionar.

## Critérios de aceite do PRD — verificação item a item

| Critério | Atendido? | Evidência |
|---|---|---|
| **1. API + Postgres sobem via Docker Compose e /health responde** | **Sim** | `docker compose up -d --build` executado na VM de dev; `curl http://localhost:8080/health` (via Caddy) retornou `{"status":"ok"}` |
| **2. Sem autenticação, rota protegida retorna 401** | **Sim** | `curl http://localhost:8080/auth/me` sem cookie retornou `401 Unauthorized`; testes automatizados (test_auth_endpoints.py::test_auth_me_without_cookie) confirmam |
| **3. Login Google end-to-end, página protegida com nome/email** | **Sim** | Validado pelo CEO em `http://financeirov2.duckdns.org:8080/` — login Google completo, cookie setado, página protegida exibida. Confirmado por linha de comando antes disso: `/auth/google/login` redirecionando com `client_id`/`redirect_uri`/`scope` corretos |
| **4. JWT expirado/inválido → 401** | **Sim** | Testes unitários (test_jwt.py::test_decode_jwt_expired, test_decode_jwt_invalid_signature) e integração (test_auth_endpoints.py com cookie inválido) passando; tratamento no frontend (401 → redirect para LoginPage) testado em App.test.tsx |
| **5. CI roda em push/PR — lint e testes automaticamente** | **Sim** | Confirmado via API do GitHub: run [30943852049](https://github.com/daniellimabr/financeiro/actions/runs/30943852049) `completed`/`success`, jobs `Backend (ruff + pytest)` e `Frontend (eslint + vitest)` ambos `success` |
| **6. Pre-commit bloqueia secret (detect-secrets)** | **Sim** | `.pre-commit-config.yaml` com detect-secrets + hook instalado localmente (`pre-commit install`); `.secrets.baseline` gerado para evitar falsos positivos; hook ativo em `.git/hooks/pre-commit` |

## Documentação atualizada

- `CLAUDE.md`: atualizado — política de autonomia revisada (SSH dev sem aprovação, merge/push para main liberado nesta sessão conforme decisão CEO)
- `docs/directory-structure.md`: adicionados todos os diretórios/arquivos novos de Sprint 1 (backend/, frontend/, docker-compose.yml, Caddyfile, .env.example, .pre-commit-config.yaml, .secrets.baseline, .github/workflows/ci.yml) com descrições
- `docs/architecture/OVERVIEW.md`: expandido com VM de dev como infraestrutura permanente, Docker Compose detalhado (4 serviços, healthchecks, roteamento Caddy), fluxo git-sync (push local → pull VM → docker compose up), topologia de portas (SSH 22, preview 8080, roteamento /auth/* e /health para api)
- `docs/infra/ssh-workflow.md`: reescrito (já feito em planejamento)
- Novo: `docs/sprints/SPRINT-001-fundacao-tecnica-plan.md` (plano — already existed)
- Novo: `docs/sprints/SPRINT-001-fundacao-tecnica-report.md` (este arquivo)

## Consumo estimado de tokens/sessões

Execução em 1 sessão contínua (2026-08-04): Sonnet para toda a implementação (backend, frontend, Docker, CI, deploy na VM), Haiku para atualização de docs vivos e este relatório, conforme a divisão de modelos do CLAUDE.md. Não há medição exata de tokens disponível nesta sessão — não estimar um número sem essa medição.

## Pendências e próximos passos sugeridos

Os dois bloqueadores do CEO foram resolvidos ainda durante a Sprint 1 (não ficaram para depois do relatório):

1. **Porta 8080 liberada** — precisou de 3 ajustes, não só um: (a) Security List correta na VCN (havia duas, a regra inicial foi criada na errada), (b) `iptables` da própria VM (a imagem Ubuntu da Oracle vem com um `REJECT` padrão em tudo que não é porta 22 — ver decisão #8 acima), (c) redirect URI do Google exige domínio com TLD, não IP puro — resolvido com DuckDNS (`financeirov2.duckdns.org`).
2. **Credenciais Google OAuth criadas** e login validado end-to-end pelo CEO no navegador.

Com isso, todos os 6 critérios de aceite do PRD-001 estão confirmados (seção acima) e a Sprint 1 está tecnicamente completa, aguardando só aprovação formal do CEO sobre este relatório.

### Próximos passos técnicos sugeridos

1. **Sprint 2 — Schema de domínio** (E4 — desbloqueado):
   - Tabelas `accounts`, `transactions`, `category_rules`, `expense_categories`, `income_categories`, `assets`, `liabilities`
   - Isolamento `user_id` obrigatório em todas
   - CRUD endpoints para gestão de categorias/ativos/passivos
   - Migrations Alembic reversíveis
   - Testes ≥80% cobertura

2. **Validação da VM em produção** (adiado, sob aprovação CEO):
   - Nova instância Oracle Free Tier (separada de dev)
   - Restrição SSH apenas para CLI deploy (sem autonomia — exige aprovação por comando)
   - DNS reservado apontando para prod
   - TLS real via Let's Encrypt + Caddy

3. **Import do Financeiro v1** (E8 — desbloqueado, depende de schema Sprint 2):
   - Leitura do arquivo legado (categorias + memória de classificação)
   - Upsert em `category_rules` + memória compartilhada (opt-in por usuário)
   - Validação: nenhum valor/descrição de transação do v1 vazado entre usuários

### Observações de confiabilidade

- VM de dev fica online 24/7 em Oracle Cloud Free Tier (sem SLA formal, mas estável em testes prévios)
- Snapshots do banco recomendados periodicamente (backups manuais) — não implementado nesta sprint, fica para infrastructure sprint futura
- Security List da porta 22 (SSH) está aberta a `0.0.0.0/0`, não restrita ao IP do CEO — decisão consciente dele por ter IP dinâmico; mitigado com fail2ban + autenticação só por chave (ver decisão de risco registrada na tarefa 0). Porta 8080 (preview web) também ficou aberta a `0.0.0.0/0`, o que é esperado para uma aplicação web pública
- fail2ban instalado na VM para mitigar força bruta SSH; regra padrão: 5 tentativas em 10min → bloqueio 10min

## Assinatura de conclusão

CTO (Claude Code): Sprint 1 concluída — código pronto, testes verdes, CI verde, login Google validado end-to-end pelo CEO no navegador, documentação atualizada.

---

**Próximo:** CEO aprova este relatório → planejamento da Sprint 2 (E4 — schema de domínio + E8 — import do legado).
