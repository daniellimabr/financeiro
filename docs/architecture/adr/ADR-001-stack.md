# ADR-001: Stack tecnológica do Financeiro v2

- **Status:** aprovado
- **Data:** 2026-08-03

## Contexto

Restrições fixas (não deliberar): Oracle Cloud VM Free Tier com banco no mesmo servidor; sync Pluggy manual (sem fila/agendador agora); categorização por regras+memória sem LLM; dashboards por leitura/agregação simples sem cache complexo; multiusuário OAuth Google (2→~10 usuários); licença Claude Pro exige sessões enxutas. Critério de escolha: **simplicidade operacional dentro do free tier > modernidade**.

O free tier Oracle inclui VM(s) Ampere A1 (até 4 OCPU/24GB RAM agregados) ou AMD VM.Standard.E2.1.Micro — recursos modestos, então a stack não pode depender de múltiplos serviços pesados (sem cluster, sem fila de mensageria, sem cache distribuído).

## Decisão

| Camada | Escolha | Motivo |
|---|---|---|
| Backend | **Python 3.12 + FastAPI** | Async nativo, tipagem via Pydantic, boa ergonomia para integração HTTP com Pluggy, ecossistema maduro para OAuth (Authlib) |
| ORM / Migrations | **SQLAlchemy 2.0 + Alembic** | Migrations reversíveis (exigido pela DoD), maduro, evita SQL cru repetitivo |
| Banco de dados | **PostgreSQL** (container no mesmo VM) | Agregações simples via SQL são suficientes (decisão já tomada de não usar tempo real/cache complexo); JSON nativo útil para regras de categorização flexíveis |
| Autenticação | **Google OAuth 2.0 via Authlib**, sessão por JWT em cookie httpOnly | Único provedor exigido; evita implementar sistema de senha próprio |
| Frontend | **React + Vite + TypeScript** | SPA leve o suficiente para drill-down interativo nos dashboards; bom suporte de tooling (inclui Impeccable) |
| Gráficos | **Recharts** | Biblioteca simples, suficiente para os dashboards descritos (sem necessidade de customização pesada) |
| Estado/dados no frontend | **TanStack Query** | Cache de requisições simples, sem Redux/estado global desnecessário |
| Tarefas em background | **Nenhuma (síncrono)** | Sync Pluggy é manual por decisão; não introduzir Celery/fila agora — reavaliar apenas se sync agendado entrar no roadmap |
| Testes backend | **pytest + pytest-cov** | Padrão do ecossistema Python, cobertura mensurável para meta ≥80% em lógica de negócio |
| Testes frontend | **Vitest + Testing Library** | Compatível com Vite, rápido |
| Lint/format | **Ruff** (lint+format Python), **ESLint + Prettier** (TS) | Ferramentas únicas por linguagem, configuráveis em pre-commit |
| Pre-commit | **pre-commit framework** com ruff, eslint, e **detect-secrets** (scan de segredos) | Atende DoD: zero secrets, lint sem erros, hook automático |
| Deploy | **Docker Compose** na VM (containers: postgres, api, frontend estático via Nginx/Caddy) | Reversível, simples de operar sem orquestrador, roda confortavelmente no free tier |
| Reverse proxy / TLS | **Caddy** | TLS automático (Let's Encrypt) com configuração mínima — menos operação manual que Nginx+certbot |

## Alternativas consideradas

| Opção | Prós | Contras | Motivo da rejeição |
|---|---|---|---|
| Node.js + Express/Nest no backend | Uma linguagem só (TS full-stack) | Ecossistema de agregação financeira e OAuth server-side menos direto que Python; equipe (CEO) não indicou preferência | Python+FastAPI tem melhor ergonomia para integrações HTTP tipo Pluggy e é comparável em simplicidade |
| Supabase / Firebase (BaaS gerenciado) | Menos operação manual, Auth pronto | Decisão já fixa de banco no mesmo servidor da VM; sairia do free tier Oracle puro | Contraria restrição de ambiente já decidida |
| Next.js full-stack (backend+frontend juntos) | Um único deploy | Mistura responsabilidades, dificulta reversibilidade de migrations e testes de API isolados | API separada é mais simples de testar e documentar (OpenAPI automático do FastAPI) |
| MongoDB | Schema flexível para regras de categorização | Agregações de dashboard (somas por categoria/mês) são mais naturais e testáveis em SQL relacional | Dados financeiros são inerentemente relacionais (contas, transações, ativos) |
| Redis para cache de dashboards | Dashboards mais rápidos | Decisão já tomada: sem cache complexo; adiciona um serviço a mais no free tier | Agregações pré-calculadas na sync (tabelas de resumo) resolvem sem serviço extra |

## Consequências

- Positivas: stack inteira roda em 3-4 containers Docker Compose num único VM free tier; migrations e testes seguem padrões bem documentados; TLS automático sem esforço manual.
- Negativas / trade-offs aceitos: sem fila de background desde já significa que, se sync agendado entrar no roadmap futuramente, será necessário introduzir um scheduler (ex.: APScheduler dentro do próprio processo FastAPI é suficiente para o volume esperado — não decidir agora).
- Impacto em decisões futuras: se o volume de usuários crescer muito além de ~10 ou o volume de transações exigir cache, revisar via novo ADR (não a stack como um todo, apenas a camada afetada).

## Referências

- Restrições de Ambiente e tabela de decisões fixas — prompt de bootstrap / [CLAUDE.md](../../../CLAUDE.md).
- [docs/roadmap.md](../../roadmap.md)
