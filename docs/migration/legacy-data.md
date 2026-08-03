# Migração de dados do Financeiro v1

Reaproveitamento **estrito**: apenas os dois artefatos abaixo. Nenhum código do v1 é consultado ou copiado.

## 1. Categorias e subcategorias

Formato de entrada esperado (CSV ou JSON — CEO fornece; ajustar este doc ao formato real ao receber os dados):

```csv
categoria,subcategoria,natureza
Moradia,Aluguel,fixa
Moradia,Condomínio,fixa
Alimentação,Mercado,variável
Alimentação,Restaurante,eventual
```

- `categoria` / `subcategoria`: texto livre, normalizado em import (trim, capitalização consistente).
- `natureza`: um de `fixa | variável | eventual` (ver escopo funcional #10 — natureza de custo é independente da categoria em si, mas o v1 já traz uma associação default que serve de seed).
- Import gera registros únicos por par (categoria, subcategoria); duplicatas são mescladas, não sobrescritas silenciosamente (log de conflitos).

## 2. Memória de classificação (regras aprendidas)

Formato de entrada esperado: mapeamento **descrição-padrão da transação → categoria/subcategoria**, sem valores monetários nem metadados de conta.

```csv
padrao_descricao,categoria,subcategoria,confianca
"PAG*IFOOD*","Alimentação","Restaurante",alta
"UBER TRIP","Transporte","Aplicativo",alta
```

- `padrao_descricao`: string ou regex simples usada para casar a descrição bruta do extrato/cartão.
- `confianca`: opcional; usado para desempate quando múltiplas regras casam.
- **Este é o único artefato elegível para a memória compartilhada entre usuários** (opt-in) — ver regra de segurança transversal no CLAUDE.md: nunca compartilhar valores ou descrições brutas de transação, apenas o mapeamento padrão→categoria.

## Processo de import

1. CEO fornece os dois arquivos (formato a confirmar quando chegarem — atualizar exemplos acima se divergir).
2. Script de import (a implementar em sprint futura, não na Fase 0) valida schema, reporta duplicatas/conflitos, e popula:
   - tabela de categorias/subcategorias (seed inicial do sistema).
   - tabela de regras de memória de classificação, associada ao usuário que importou (respeitando opt-in antes de qualquer compartilhamento).
3. Nenhum dado transacional (extratos, saldos) vem do v1 — a sincronização de transações começa do zero via Pluggy, com corte a partir de fim de dezembro/2025.

## Pendências

- Formato exato dos arquivos do CEO ainda não recebido — este doc usa formato hipotético como placeholder até a entrega real.
- Decidir em qual sprint o script de import é implementado (proposta em [docs/roadmap.md](../roadmap.md)).
