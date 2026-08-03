# Arquitetura — Visão Geral

> Stack abaixo reflete a proposta de [ADR-001](adr/ADR-001-stack.md), ainda **aguardando aprovação do CEO**. Este doc será atualizado a cada mudança estrutural relevante (regra de doc viva).

## Visão de alto nível

```
[Google OAuth] ---- login ----> [Frontend React/Vite] <---HTTP/JSON---> [API FastAPI] ---> [PostgreSQL]
                                                                              |
                                                                              +--> [Pluggy API] (sync manual, sob demanda do usuário)
```

Um único VM Oracle Free Tier roda tudo via Docker Compose: `postgres`, `api`, `frontend` (build estático servido por Caddy), `caddy` (reverse proxy/TLS).

## Componentes

- **API (FastAPI):** autenticação (Google OAuth), endpoints de sync Pluggy, CRUD de categorias/ativos/passivos, endpoints de agregação para dashboards. Lógica de negócio (categorização por regras+memória, competência de receita, cálculo de patrimônio) vive aqui, testada via pytest.
- **Banco (PostgreSQL):** schema relacional — usuários, contas, transações, categorias/subcategorias, natureza de custo, ativos/passivos, regras de memória de categorização, tabelas de agregação pré-calculada (por mês/usuário) para os dashboards.
- **Frontend (React/Vite):** dashboards com drill-down, telas de setup (credenciais Pluggy, contas, corte de histórico), gestão de categorias/ativos/passivos, perfil/logout.
- **Integração Pluggy:** chamada síncrona disparada por botão "sincronizar" no frontend; sem job agendado nesta fase.

## Isolamento de dados por usuário

Toda tabela transacional tem `user_id` obrigatório; toda query de aplicação filtra por usuário autenticado (nunca por sessão implícita). Memória de categorização compartilhada é a única exceção, e apenas para o mapeamento descrição-padrão→categoria, nunca para valores/descrições brutas — ver [docs/migration/legacy-data.md](../migration/legacy-data.md).

## O que ainda não existe (fase 0)

Nenhum código de produto foi escrito. Este doc descreve a arquitetura **proposta**; será expandido com diagramas de schema e sequência assim que a primeira sprint de implementação rodar.

## Referências

- [ADR-001 — Stack](adr/ADR-001-stack.md)
- [docs/directory-structure.md](../directory-structure.md)
- [docs/roadmap.md](../roadmap.md)
