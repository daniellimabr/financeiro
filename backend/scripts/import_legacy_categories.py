"""Importa categorias/subcategorias do Financeiro v1 a partir de um CSV.

Formato esperado do CSV: colunas `grupo,subcategoria`. Upsert por par
(grupo, subcategoria) — se o par já existe, não sobrescreve, apenas loga
o conflito (ver docs/migration/legacy-data.md).

Uso: python scripts/import_legacy_categories.py [caminho_csv]
(padrão: scripts/data/legacy_categories.csv)
"""

import argparse
import csv
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.models.category import CategoryGroup, Subcategory  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("import_legacy_categories")

DEFAULT_CSV_PATH = Path(__file__).resolve().parent / "data" / "legacy_categories.csv"


def import_categories(db: Session, csv_path: Path) -> dict[str, int]:
    stats = {"groups_created": 0, "subcategories_created": 0, "conflicts": 0}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            grupo_nome = row["grupo"].strip()
            subcategoria_nome = row["subcategoria"].strip()

            group = (
                db.query(CategoryGroup).filter(CategoryGroup.nome.ilike(grupo_nome)).one_or_none()
            )
            if group is None:
                group = CategoryGroup(nome=grupo_nome)
                db.add(group)
                db.flush()
                stats["groups_created"] += 1

            existing = (
                db.query(Subcategory)
                .filter(
                    Subcategory.group_id == group.id,
                    Subcategory.nome.ilike(subcategoria_nome),
                )
                .one_or_none()
            )
            if existing is not None:
                logger.warning(
                    "Conflito: %s/%s já existe (id=%s) — não sobrescrito",
                    grupo_nome,
                    subcategoria_nome,
                    existing.id,
                )
                stats["conflicts"] += 1
                continue

            db.add(Subcategory(group_id=group.id, nome=subcategoria_nome))
            db.flush()
            stats["subcategories_created"] += 1

    db.commit()
    logger.info(
        "Import concluído: %s grupo(s) criado(s), %s subcategoria(s) criada(s), %s conflito(s)",
        stats["groups_created"],
        stats["subcategories_created"],
        stats["conflicts"],
    )
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Import categorias/subcategorias do legado")
    parser.add_argument(
        "csv_path",
        nargs="?",
        default=str(DEFAULT_CSV_PATH),
        help="Caminho para o CSV grupo,subcategoria",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        import_categories(db, Path(args.csv_path))
    finally:
        db.close()


if __name__ == "__main__":
    main()
