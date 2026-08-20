from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import DuplicateNameError, InvalidStateError, NotFoundError
from app.models.categorization import CategorizationRule
from app.models.category import CategoryGroup, Natureza, Subcategory
from app.models.orcamento import Orcamento
from app.models.pluggy import PluggyTransaction


def list_groups(db: Session, user_id: int) -> list[CategoryGroup]:
    return (
        db.query(CategoryGroup)
        .filter(CategoryGroup.user_id == user_id)
        .order_by(CategoryGroup.nome)
        .all()
    )


def get_group(db: Session, user_id: int, group_id: int) -> CategoryGroup:
    group = (
        db.query(CategoryGroup)
        .filter(CategoryGroup.id == group_id, CategoryGroup.user_id == user_id)
        .one_or_none()
    )
    if group is None:
        raise NotFoundError(f"Grupo de categoria {group_id} não encontrado")
    return group


def _assert_group_name_available(
    db: Session, user_id: int, nome: str, *, exclude_id: int | None = None
) -> None:
    query = db.query(CategoryGroup).filter(
        CategoryGroup.user_id == user_id, func.lower(CategoryGroup.nome) == nome.lower()
    )
    if exclude_id is not None:
        query = query.filter(CategoryGroup.id != exclude_id)
    if query.first() is not None:
        raise DuplicateNameError(f"Já existe um grupo de categoria chamado '{nome}'")


def create_group(db: Session, user_id: int, *, nome: str) -> CategoryGroup:
    _assert_group_name_available(db, user_id, nome)
    group = CategoryGroup(user_id=user_id, nome=nome)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def update_group(db: Session, user_id: int, group_id: int, *, nome: str) -> CategoryGroup:
    group = get_group(db, user_id, group_id)
    _assert_group_name_available(db, user_id, nome, exclude_id=group_id)
    group.nome = nome
    db.commit()
    db.refresh(group)
    return group


def _subcategory_usage_counts(db: Session, user_id: int, subcategory_id: int) -> dict[str, int]:
    return {
        "transações": db.query(PluggyTransaction)
        .filter(
            PluggyTransaction.user_id == user_id,
            PluggyTransaction.subcategory_id == subcategory_id,
        )
        .count(),
        "regras de categorização": db.query(CategorizationRule)
        .filter(
            CategorizationRule.user_id == user_id,
            CategorizationRule.subcategory_id == subcategory_id,
        )
        .count(),
        "orçamentos": db.query(Orcamento)
        .filter(Orcamento.user_id == user_id, Orcamento.subcategory_id == subcategory_id)
        .count(),
    }


def _assert_subcategory_not_in_use(db: Session, user_id: int, subcategory: Subcategory) -> None:
    usage = _subcategory_usage_counts(db, user_id, subcategory.id)
    if any(usage.values()):
        detalhe = ", ".join(f"{count} {nome}" for nome, count in usage.items() if count)
        raise InvalidStateError(
            f"Subcategoria '{subcategory.nome}' está em uso ({detalhe}) — não pode ser excluída"
        )


def delete_group(db: Session, user_id: int, group_id: int) -> None:
    group = get_group(db, user_id, group_id)
    for subcategory in group.subcategories:
        _assert_subcategory_not_in_use(db, user_id, subcategory)
    db.delete(group)
    db.commit()


def list_subcategories(
    db: Session, user_id: int, *, group_id: int | None = None
) -> list[Subcategory]:
    query = db.query(Subcategory).filter(Subcategory.user_id == user_id)
    if group_id is not None:
        query = query.filter(Subcategory.group_id == group_id)
    return query.order_by(Subcategory.nome).all()


def get_subcategory(db: Session, user_id: int, subcategory_id: int) -> Subcategory:
    subcategory = (
        db.query(Subcategory)
        .filter(Subcategory.id == subcategory_id, Subcategory.user_id == user_id)
        .one_or_none()
    )
    if subcategory is None:
        raise NotFoundError(f"Subcategoria {subcategory_id} não encontrada")
    return subcategory


def _assert_subcategory_name_available(
    db: Session, user_id: int, group_id: int, nome: str, *, exclude_id: int | None = None
) -> None:
    query = db.query(Subcategory).filter(
        Subcategory.user_id == user_id,
        Subcategory.group_id == group_id,
        func.lower(Subcategory.nome) == nome.lower(),
    )
    if exclude_id is not None:
        query = query.filter(Subcategory.id != exclude_id)
    if query.first() is not None:
        raise DuplicateNameError(f"Já existe a subcategoria '{nome}' nesse grupo")


def create_subcategory(
    db: Session, user_id: int, *, group_id: int, nome: str, natureza: Natureza | None
) -> Subcategory:
    get_group(db, user_id, group_id)
    _assert_subcategory_name_available(db, user_id, group_id, nome)
    subcategory = Subcategory(user_id=user_id, group_id=group_id, nome=nome, natureza=natureza)
    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)
    return subcategory


def update_subcategory(
    db: Session,
    user_id: int,
    subcategory_id: int,
    *,
    group_id: int,
    nome: str,
    natureza: Natureza | None,
) -> Subcategory:
    subcategory = get_subcategory(db, user_id, subcategory_id)
    get_group(db, user_id, group_id)
    _assert_subcategory_name_available(db, user_id, group_id, nome, exclude_id=subcategory_id)
    subcategory.group_id = group_id
    subcategory.nome = nome
    subcategory.natureza = natureza
    db.commit()
    db.refresh(subcategory)
    return subcategory


def delete_subcategory(db: Session, user_id: int, subcategory_id: int) -> None:
    subcategory = get_subcategory(db, user_id, subcategory_id)
    _assert_subcategory_not_in_use(db, user_id, subcategory)
    db.delete(subcategory)
    db.commit()
