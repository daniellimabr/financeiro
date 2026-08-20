"""Importa a memória de classificação (regras) do Financeiro v1 para um usuário.

Formato de entrada: `semente-classificacao.json` (ver docs/migration/legacy-data.md),
campo "regras": lista de `{padrao_descricao, categoria, origem}`, onde `categoria` é
`"Grupo/Subcategoria"`. Upsert por `(user_id, padrao_normalizado)` — se já existe, não
sobrescreve, só loga conflito (mesmo padrão de import_legacy_categories.py, Sprint 2).
Categoria que não resolve contra a taxonomia já existente é logada e pulada.

Uso: python scripts/import_legacy_categorization_rules.py --user-email <email> [caminho_json]
(padrão do caminho: scripts/data/semente-classificacao.json)
"""

import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session  # noqa: E402

from app.categorization.normalize import normalize_description  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models.categorization import CategorizationRule  # noqa: E402
from app.models.category import CategoryGroup, Subcategory  # noqa: E402
from app.models.user import User  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("import_legacy_categorization_rules")

DEFAULT_JSON_PATH = Path(__file__).resolve().parent / "data" / "semente-classificacao.json"


def _resolve_subcategory(db: Session, user_id: int, categoria: str) -> Subcategory | None:
    if "/" not in categoria:
        return None
    grupo_nome, subcategoria_nome = categoria.split("/", 1)
    grupo_nome = grupo_nome.strip()
    subcategoria_nome = subcategoria_nome.strip()

    group = (
        db.query(CategoryGroup)
        .filter(CategoryGroup.user_id == user_id, CategoryGroup.nome.ilike(grupo_nome))
        .one_or_none()
    )
    if group is None:
        return None

    return (
        db.query(Subcategory)
        .filter(
            Subcategory.user_id == user_id,
            Subcategory.group_id == group.id,
            Subcategory.nome.ilike(subcategoria_nome),
        )
        .one_or_none()
    )


def import_legacy_rules(db: Session, user_id: int, json_path: Path) -> dict[str, int]:
    stats = {"created": 0, "conflicts": 0, "unresolved": 0}

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    for regra in data.get("regras", []):
        padrao_descricao = regra["padrao_descricao"].strip()
        categoria = regra["categoria"].strip()

        subcategory = _resolve_subcategory(db, user_id, categoria)
        if subcategory is None:
            logger.warning(
                "Categoria não resolvida: '%s' (regra '%s') — pulada", categoria, padrao_descricao
            )
            stats["unresolved"] += 1
            continue

        padrao_normalizado = normalize_description(padrao_descricao)

        existing = (
            db.query(CategorizationRule)
            .filter(
                CategorizationRule.user_id == user_id,
                CategorizationRule.padrao_normalizado == padrao_normalizado,
            )
            .one_or_none()
        )
        if existing is not None:
            logger.warning(
                "Conflito: padrão '%s' já existe para o usuário %s (id=%s) — não sobrescrito",
                padrao_normalizado,
                user_id,
                existing.id,
            )
            stats["conflicts"] += 1
            continue

        db.add(
            CategorizationRule(
                user_id=user_id,
                subcategory_id=subcategory.id,
                padrao_descricao=padrao_descricao,
                padrao_normalizado=padrao_normalizado,
                origem="legado",
            )
        )
        db.flush()
        stats["created"] += 1

    db.commit()
    logger.info(
        "Import concluído: %s regra(s) criada(s), %s conflito(s), %s categoria(s) não resolvida(s)",
        stats["created"],
        stats["conflicts"],
        stats["unresolved"],
    )
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import da memória de classificação do legado para um usuário"
    )
    parser.add_argument("--user-email", required=True, help="E-mail do usuário dono das regras")
    parser.add_argument(
        "json_path",
        nargs="?",
        default=str(DEFAULT_JSON_PATH),
        help="Caminho para o semente-classificacao.json",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.user_email).one_or_none()
        if user is None:
            logger.error("Usuário com e-mail '%s' não encontrado — abortando", args.user_email)
            sys.exit(1)

        import_legacy_rules(db, user.id, Path(args.json_path))
    finally:
        db.close()


if __name__ == "__main__":
    main()
