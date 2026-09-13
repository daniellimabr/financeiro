# Scan `aislop` — 2026-09-11

Ferramenta externa (`npx aislop scan`, terceiros, não relacionada ao fluxo interno
`structural-auditor`). Rodada ad-hoc pelo CEO para avaliar qualidade de código.

## Resultado

- Scan padrão (418 arquivos, inclui todo o repo): **66/100**, 72 erros, 320 avisos.
- Scan excluindo `.claude/skills/impeccable` (skill de terceiros vendorizado no
  commit de bootstrap, não é código nosso): **315 arquivos, 92/100 ("Healthy"),
  0 erros, 57 avisos**.

A diferença inteira (72 erros, ~260 avisos) vinha de dentro do skill `impeccable`
— principalmente `scripts/detector/browser/injected/index.mjs` (2024 linhas,
bundle minificado de terceiros) e `scripts/live-browser.js`. São globals de bundle
que o linter do aislop não reconhece e `innerHTML` no próprio código do skill —
nada disso é gerado por nós nem roda como parte do app.

**Recorrência:** ao rodar `aislop scan` (ou ferramenta similar) neste repo no
futuro, excluir o vendor primeiro para não distorcer o score:

```
npx aislop scan --exclude .claude/skills
```

## Achados reais revisados (fora do vendor)

| Local | Achado do aislop | Veredito |
|---|---|---|
| `backend/alembic/env.py:8` | import `User` não usado | Falso positivo — `# noqa: F401` já documenta que é necessário para o Alembic autogenerate registrar o model no metadata. **Não remover** (o auto-fix do aislop quebraria isso). |
| `backend/app/config.py:25` | URL hardcoded | Falso positivo — default público da API Pluggy (`pluggy_base_url`), sobrescrevível por env var via pydantic-settings. Não é secret. |
| `backend/app/dashboards/service.py:1274` | `.get(x, {}).get(y, default)` encadeado | Revisado — lookup intencional em dict aninhado (saldo por conta/mês). Não é bug. |
| `scripts/ssh_vm.py` | formatação incorreta | Falso positivo — `ruff format --diff` do venv do backend confirma que já está formatado; `scripts/` fica fora do escopo de `backend/pyproject.toml`, então o aislop aplicou defaults diferentes. |
| `backend/app/assets/service.py:44`, `categorization/service.py:152`, `liabilities/service.py:48` | funções com 7–9 parâmetros | Real, cosmético. Candidatos a objeto de opções/schema de update, sem urgência. |
| `frontend/src/pages/DashboardsPage.tsx` (1618 linhas), `AccountManagementPage.tsx` (713), `InvestimentosPage.tsx` (841) | arquivos grandes | Real — débito técnico conhecido de tamanho. Candidato a quebrar em subcomponentes numa sprint futura de refino, não é correção pontual.

## Ação tomada

Nenhuma mudança de código — nenhum achado real exigia correção urgente, e o único
item "fixable" automaticamente (import do alembic) teria quebrado o autogenerate
se aplicado às cegas. Ver [[../../CLAUDE.md]] — DoD não exige zerar avisos de
ferramentas externas não incorporadas ao pipeline de CI do projeto.
