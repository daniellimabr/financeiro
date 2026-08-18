# Financeiro v2 — CLAUDE.md

Reinício do zero do sistema financeiro pessoal/familiar (Financeiro v1 aposentado — não consultar seu código).
CEO: idealiza, aprova planos, valida entregas. CTO (Claude Code): planeja, arquiteta, implementa.

**Regra de ouro:** uma nova sessão deve se orientar lendo este arquivo + no máximo 2 docs abaixo, sem reler código.

## Onde encontrar cada coisa

| Preciso de... | Doc |
|---|---|
| Arquitetura/infra/lógica atual | [docs/architecture/OVERVIEW.md](docs/architecture/OVERVIEW.md) |
| Decisões técnicas (por quê da stack) | [docs/architecture/adr/](docs/architecture/adr/) |
| Especificação de uma funcionalidade | [docs/prd/](docs/prd/) |
| Épicos e sequência de sprints | [docs/roadmap.md](docs/roadmap.md) |
| Plano/relatório de uma sprint | [docs/sprints/](docs/sprints/) |
| Mapa de diretórios do repo | [docs/directory-structure.md](docs/directory-structure.md) |
| O que cada card do Dashboard soma/exclui | [docs/dashboards-guia-cards.md](docs/dashboards-guia-cards.md) |
| Procedimento de SSH para a VM | [docs/infra/ssh-workflow.md](docs/infra/ssh-workflow.md) |
| Formato de import do v1 (categorias + memória) | [docs/migration/legacy-data.md](docs/migration/legacy-data.md) |

## Decisões fixas (não reabrir sem pedido explícito do CEO)

| Tema | Decisão |
|---|---|
| Infra | Oracle Cloud VM Free Tier — **não existe ambiente de produção ainda** (correção do CEO, 2026-08-18: a VM de **dev**, provisionada em 2026-08-04 porque Docker/WSL2 são bloqueados no notebook corporativo, é hoje o único ambiente rodando o app, com dados reais da Pluggy sincronizados nela). Ver [docs/infra/ssh-workflow.md](docs/infra/ssh-workflow.md) |
| SSH | Sempre a partir de venv Python, via **paramiko** (não o binário `ssh.exe`) — ver [docs/infra/ssh-workflow.md](docs/infra/ssh-workflow.md). VM de **dev** (único ambiente real hoje): Claude executa livremente. Se/quando uma VM de **prod** for provisionada: aprovação do CEO por comando, sem exceção |
| Sync Pluggy | Manual (botão); rotina agendada é backlog futuro |
| Categorização | Regras + memória de revisões do usuário. Sem LLM na pipeline |
| Dashboards | Leitura direta/agregação simples. Sem tempo real, sem cache complexo |
| Corte de dados | Receitas de fim de dez/2025 importadas; corte real em jan/2026 |
| Usuários | Multiusuário, OAuth Google. 2 usuários hoje, arquitetura permite ~10 |
| Memória compartilhada | Opt-in por usuário; só mapeamento descrição→categoria, nunca valores/descrições brutas de transação |
| Modelos | Sonnet: planejamento/arquitetura/implementação/revisão. Haiku: docs, commits, Graphify, formatação |
| Reaproveitamento do v1 | Só categorias/subcategorias + memória de classificação (dados, não código) |

Stack de backend/frontend/DB/ORM/deploy: ver [ADR-001](docs/architecture/adr/ADR-001-stack.md) — aprovado em 2026-08-03.

## Política de autonomia (resumo — ver prompt de bootstrap para texto completo)

- **Faço sem pedir:** editar repo local, commits/push/branches em `main` (autorizado pelo CEO em 2026-08-04 — controle do código do projeto, incluindo `main`, é do CTO), testes/lint/migrations locais, atualizar docs vivos, instalar deps de dev, comandos SSH na VM de **dev** (via `scripts/ssh_vm.py`/`ssh-vm.ps1`, paramiko).
- **Proponho e aguardo OK:** deploy ou SSH na VM de **produção**, mudança de stack/ADR aprovado, ações com custo ou credenciais reais (inclui provisionar VMs), exclusão de dados/migrations destrutivas, novo plugin não listado.
- **Nunca faço:** deploy sem relatório de sprint aprovado, commit de secrets, reabrir decisões da tabela acima sem solicitação.

## Fluxo por sprint

Input do CEO → `/plan` (PRD + plano de sprint) → aprovação → execução em sessão nova (`/clear`) → relatório pós-execução → aprovação → deploy na VM → validação → doc-updater atualiza documentação viva.

## Definition of Done

Ver checklist completo no prompt de bootstrap. Resumo: itens do plano implementados (ou desvio justificado), testes automatizados (≥80% cobertura em lógica de negócio), suíte 100% verde, lint sem erros, zero secrets, docs atualizadas, migrations reversíveis, relatório de sprint completo, critérios do PRD verificados item a item.

## Segurança transversal

Secrets nunca em commit (env vars + .gitignore desde o commit 1). Isolamento de dados por usuário em toda query. Memória compartilhada nunca vaza valores/descrições de transação entre usuários.

## Plugins ativos

Ver [docs/architecture/adr/ADR-002-plugins.md](docs/architecture/adr/ADR-002-plugins.md) para justificativa de cada ativação/desativação.
