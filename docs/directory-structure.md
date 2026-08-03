# Estrutura de diretórios

Atualizado a cada mudança estrutural. Estado atual (fim da Fase 0 — bootstrap, sem código de produto):

```
Financeiro v3/
├── CLAUDE.md                       # doc viva raiz — ponto de entrada
├── PRODUCT.md                      # fatos de produto (gerado pelo Impeccable /impeccable init)
├── .gitignore
├── .claude/
│   ├── settings.json               # plugins habilitados no projeto (Ponytail)
│   ├── agents/                     # 5 agentes do ECC copiados seletivamente (ver ADR-002)
│   └── skills/
│       ├── tdd-workflow/           # skill do ECC copiada seletivamente
│       └── impeccable/             # skill completa do plugin Impeccable
├── docs/
│   ├── architecture/
│   │   ├── OVERVIEW.md             # arquitetura/infra/lógica proposta
│   │   └── adr/
│   │       ├── ADR-001-stack.md    # stack aprovada em 2026-08-03
│   │       └── ADR-002-plugins.md  # plugins ativados/desativados e por quê
│   ├── prd/                        # PRDs por funcionalidade (vazio na Fase 0)
│   ├── sprints/                    # planos e relatórios de sprint (vazio na Fase 0)
│   ├── roadmap.md                  # épicos + 3 primeiras sprints propostas
│   ├── directory-structure.md      # este arquivo
│   ├── infra/
│   │   └── ssh-workflow.md         # procedimento SSH obrigatório via venv
│   └── migration/
│       └── legacy-data.md          # formato de import de categorias + memória do v1
├── templates/
│   ├── PRD-template.md
│   ├── ADR-template.md
│   ├── SPRINT-plan-template.md
│   └── SPRINT-report-template.md
├── scripts/
│   └── ssh-vm.ps1                  # wrapper de SSH via venv Python
└── .claude/                        # config local do Claude Code (agentes/hooks do projeto)
```

## O que ainda não existe

`backend/`, `frontend/`, `docker-compose.yml`, `.env.example`, `DESIGN.md` — ADR-001 já aprovado; esses diretórios/arquivos são criados a partir da Sprint 1. `DESIGN.md` especificamente será gerado pelo fluxo `new-work` do Impeccable quando o primeiro trabalho visual começar (ver [ADR-002](architecture/adr/ADR-002-plugins.md)).

## Convenção

- Toda pasta nova de código de produto (`backend/`, `frontend/`) deve ser refletida aqui na sprint que a criar.
- PRDs numerados sequencialmente (`PRD-001-...`), ADRs idem (`ADR-NNN-...`), sprints idem (`SPRINT-NNN-...`).
