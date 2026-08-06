from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import DuplicateNameError, NotFoundError
from app.models.category import CategoryGroup, Natureza, Subcategory


def list_groups(db: Session) -> list[CategoryGroup]:
    return db.query(CategoryGroup).order_by(CategoryGroup.nome).all()


def get_group(db: Session, group_id: int) -> CategoryGroup:
    group = db.get(CategoryGroup, group_id)
    if group is None:
        raise NotFoundError(f"Grupo de categoria {group_id} não encontrado")
    return group


def _assert_group_name_available(db: Session, nome: str, *, exclude_id: int | None = None) -> None:
    query = db.query(CategoryGroup).filter(func.lower(CategoryGroup.nome) == nome.lower())
    if exclude_id is not None:
        query = query.filter(CategoryGroup.id != exclude_id)
    if query.first() is not None:
        raise DuplicateNameError(f"Já existe um grupo de categoria chamado '{nome}'")


def create_group(db: Session, *, nome: str) -> CategoryGroup:
    _assert_group_name_available(db, nome)
    group = CategoryGroup(nome=nome)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def update_group(db: Session, group_id: int, *, nome: str) -> CategoryGroup:
    group = get_group(db, group_id)
    _assert_group_name_available(db, nome, exclude_id=group_id)
    group.nome = nome
    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, group_id: int) -> None:
    group = get_group(db, group_id)
    db.delete(group)
    db.commit()


def list_subcategories(db: Session, *, group_id: int | None = None) -> list[Subcategory]:
    query = db.query(Subcategory)
    if group_id is not None:
        query = query.filter(Subcategory.group_id == group_id)
    return query.order_by(Subcategory.nome).all()


def get_subcategory(db: Session, subcategory_id: int) -> Subcategory:
    subcategory = db.get(Subcategory, subcategory_id)
    if subcategory is None:
        raise NotFoundError(f"Subcategoria {subcategory_id} não encontrada")
    return subcategory


def _assert_subcategory_name_available(
    db: Session, group_id: int, nome: str, *, exclude_id: int | None = None
) -> None:
    query = db.query(Subcategory).filter(
        Subcategory.group_id == group_id, func.lower(Subcategory.nome) == nome.lower()
    )
    if exclude_id is not None:
        query = query.filter(Subcategory.id != exclude_id)
    if query.first() is not None:
        raise DuplicateNameError(f"Já existe a subcategoria '{nome}' nesse grupo")


def create_subcategory(
    db: Session, *, group_id: int, nome: str, natureza: Natureza | None
) -> Subcategory:
    get_group(db, group_id)
    _assert_subcategory_name_available(db, group_id, nome)
    subcategory = Subcategory(group_id=group_id, nome=nome, natureza=natureza)
    db.add(subcategory)
    db.commit()
    db.refresh(subcategory)
    return subcategory


def update_subcategory(
    db: Session, subcategory_id: int, *, group_id: int, nome: str, natureza: Natureza | None
) -> Subcategory:
    subcategory = get_subcategory(db, subcategory_id)
    get_group(db, group_id)
    _assert_subcategory_name_available(db, group_id, nome, exclude_id=subcategory_id)
    subcategory.group_id = group_id
    subcategory.nome = nome
    subcategory.natureza = natureza
    db.commit()
    db.refresh(subcategory)
    return subcategory


def delete_subcategory(db: Session, subcategory_id: int) -> None:
    subcategory = get_subcategory(db, subcategory_id)
    db.delete(subcategory)
    db.commit()
