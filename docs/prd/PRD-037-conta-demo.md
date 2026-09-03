# PRD-037: Conta Demo (acesso restrito + massa de dados)

- **Status:** aprovado
- **Épico relacionado:** E11 — Conta demo (novo épico, sem trabalho anterior; registrado em
  `docs/roadmap.md` pelo `doc-updater` ao fim desta sprint).
- **Sprint(s):** [SPRINT-037-conta-demo-plan.md](../sprints/SPRINT-037-conta-demo-plan.md)

## Problema

O CEO precisa demonstrar o app (investidores, família, terceiros) sem expor dados financeiros reais
nem a própria conta. Hoje não existe nenhum conceito de conta demo, role, admin ou impersonação no
sistema (confirmado por busca no repo inteiro) — precisa ser construído do zero. Uma conta demo vazia
não serve: extratos, faturas, categorização pendente, ativos/passivos, investimentos e orçamento só
demonstram valor com dado real o suficiente para navegar.

## Decisão do CEO (sessão de planejamento, 2026-09-03)

1. **Conta fake, sem OAuth próprio** — usuário sentinela no banco (`is_demo=true`), nunca criado via
   login Google real.
2. **Troca de sessão por cookie** (não sessão paralela por token/header) — a URL secreta
   (`GET /demo/enter`) sobrescreve o cookie `financeiro_session` atual pra apontar pro usuário demo,
   reaproveitando o mesmo padrão já usado no callback do Google OAuth
   (`backend/app/auth/router.py::google_callback`). Limitação aceita conscientemente: uma única sessão
   ativa por vez no navegador — não dá pra ter uma aba na conta real e outra na demo simultaneamente.
   Para voltar à conta real: "Sair" (logout já existente) + login Google de novo.
3. **Reset via botão na UI** (não só script SSH) — "Resetar dados demo" em Configurações apaga e
   repopula a conta demo sob demanda, útil durante uma demonstração ao vivo em que dados tenham sido
   alterados (ex.: categorização confirmada).

## Escopo

### Incluído

1. **`users.is_demo`** (migration `0021`, reversível) + `demo_allowed_email` em
   `backend/app/config.py` (default `daniellimabr@gmail.com`, env-overridável).
2. **Módulo novo `backend/app/demo/`** (`router.py`, `service.py`, `seed.py`):
   - `GET /demo/enter`: exige sessão válida (`get_current_user`); 403 se
     `current_user.email != settings.demo_allowed_email`; get-or-create do usuário demo (cria +
     semeia na primeira vez); emite JWT novo pro usuário demo; `RedirectResponse` com `Set-Cookie`
     sobrescrevendo `financeiro_session`.
   - `POST /demo/reset`: mesma checagem de e-mail; apaga o dado transacional do usuário demo (delete
     direto, em ordem de dependência — não reaproveita `delete_asset`/`delete_liability`, que são
     guardados pra uso interativo item a item) e repopula via `seed_demo_data`.
   - `seed_demo_data(db, user)`: gera ~9 meses (jan–set/2026) de dado sintético cobrindo todas as
     telas — ver "Dados e modelo".
3. **`backend/scripts/seed_demo_account.py`**: script CLI fino que chama a mesma
   `seed_demo_data`/`get_or_create_demo_user` do módulo — mesmo padrão dos scripts de import já
   existentes (`import_legacy_categorization_rules.py`), útil pra popular via SSH antes da UI existir
   ou como fallback se o botão de reset falhar.
4. **`Caddyfile`**: `/demo*` adicionado ao matcher `@api`.
5. **Frontend — `ConfiguracoesPage.tsx`**: painel "Modo Demo", visível só quando
   `user.email === "daniellimabr@gmail.com"`, com botões "Entrar no modo demo"
   (`window.location.href = "/demo/enter"`) e "Resetar dados demo" (`POST /demo/reset`, com
   `window.confirm`).
6. **Frontend — `ProtectedPage.tsx`**: banner persistente "MODO DEMO" quando `user.is_demo === true`,
   com botão "Sair do modo demo" reaproveitando `useLogout`.
7. **`api/auth.ts`**: `CurrentUser.is_demo: boolean` novo.

### Fora de escopo (explicitamente)

- Sessão demo paralela à real (token/header separado) — decisão explícita do CEO de aceitar a
  limitação de sessão única.
- Sincronização real via Pluggy para a conta demo — todo dado é sintético, gerado direto no banco.
- UI de gestão de múltiplos usuários/roles — este PRD cria só o caso especial "conta demo", não um
  sistema de permissões genérico.
- Agendamento/rotina automática de reset — reset é sempre uma ação explícita (botão ou script manual).

## Critérios de aceite

1. Login normal do CEO → Configurações → botão "Entrar no modo demo" visível só pra
   `daniellimabr@gmail.com`; para qualquer outro usuário autenticado, o painel "Modo Demo" não
   aparece.
2. `GET /demo/enter` sem sessão válida, ou com sessão de outro usuário → `401`/`403`; nenhuma sessão é
   trocada.
3. Após "Entrar no modo demo", o app mostra dados fictícios em Dashboards, Categorização (com fila de
   pendências real, não vazia), Ativos, Passivos, Investimentos, Orçamento, Natureza e Gestão de
   contas — nenhum dado real da conta do CEO aparece misturado.
4. "Resetar dados demo" reseta e repopula sem erro, sem afetar nenhum dado de nenhum outro usuário.
5. "Sair do modo demo" retorna à tela de login; novo login com Google volta à conta real intacta
   (nenhum dado do CEO foi alterado pela sessão demo).
6. Suíte 100% verde, cobertura ≥80% no módulo `app/demo/`, lint sem erros, zero secrets, `Caddyfile`
   validado no deploy real (VM de dev).

## Regras de negócio

- Só `settings.demo_allowed_email` pode acionar `GET /demo/enter` e `POST /demo/reset` — checagem
  feita a partir da sessão real já autenticada no momento da chamada (nunca a partir de um parâmetro
  de request).
- O usuário demo nunca é alcançável via `/auth/google/*` — só existe pelo fluxo `/demo/enter`.
- Trocar para o modo demo sobrescreve o cookie de sessão atual — efeito colateral aceito e comunicado
  na UI (banner "MODO DEMO" + botão de saída), não escondido do usuário.
- Todo dado gerado pelo seed é sintético; nenhuma chamada à API real da Pluggy ocorre para popular a
  conta demo.
- Reset é destrutivo só para o usuário demo — nunca toca dado de outro `user_id`.

## Dados e modelo

- Migration `0021`: `users.is_demo boolean not null default false`.
- Nenhuma tabela nova além disso — o seed reaproveita o schema existente: `CategoryGroup`/
  `Subcategory` (via `seed_categories_for_user`), `PluggyItem`/`PluggyAccount`/`PluggyTransaction`,
  `CategorizationRule`, `Asset`/`Liability`, `Investimento`/`PluggyInvestment`/
  `PluggyInvestmentTransaction`/`PluggyInvestmentSnapshot`, `Orcamento`.
- Volume alvo (~9 meses, jan–set/2026): 1 item + 4 contas fake (corrente, poupança, cartão de
  crédito, investimento); transações mensais cobrindo receita (salário, competência via
  `app/categorization/competencia.py`), despesas fixas/variáveis/eventuais e pagamento de fatura
  (maioria confirmada, bloco final do período pendente pra fila de Categorização ter trabalho real);
  punhado de `categorization_rules` explícitas; 2–3 `Asset`s e 1–2 `Liability`s com despesas
  vinculadas; 1–2 `Investimento`s com snapshots mensais crescentes; algumas entradas de `Orcamento`.
- Nenhum dado sensível novo, nenhum secret — `demo_allowed_email` é só um identificador, não uma
  credencial.

## Segurança

- Dupla camada: frontend esconde o painel pra qualquer `user.email` diferente do CEO (UX), backend é
  a barreira real (`get_current_user` + checagem de e-mail em cada request aos endpoints `/demo/*`).
- Isolamento por `user_id` já existente em todo o schema cobre a conta demo de graça — sem query nova
  que precise de tratamento especial.
- JWT/cookie seguem httpOnly, mesmo mecanismo já auditado do login Google — nenhuma exposição de
  token no client.
- Erros de autorização (`401`/`403`) não vazam detalhe de implementação (mesma convenção já usada em
  `get_current_user`).

## Referências

- [ADR-001](../architecture/adr/ADR-001-stack.md) — stack de auth (JWT em cookie httpOnly, Authlib).
- [docs/architecture/OVERVIEW.md](../architecture/OVERVIEW.md) — seções "Autenticação" e "Isolamento
  de dados por usuário"; gotcha do matcher `@api` do `Caddyfile`.
- [docs/migration/legacy-data.md](../migration/legacy-data.md) — taxonomia de categorias reaproveitada
  pelo seed via `seed_categories_for_user`.
- `backend/app/auth/router.py::google_callback` — padrão de `Set-Cookie` + `RedirectResponse`
  espelhado por `GET /demo/enter`.
