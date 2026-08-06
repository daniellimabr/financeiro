import pytest

from app.categories.service import create_group, create_subcategory
from app.exceptions import DuplicateNameError, NotFoundError
from app.models.category import Natureza


def test_create_group_rejects_duplicate_name_case_insensitive(db_session):
    create_group(db_session, nome="Moradia")

    with pytest.raises(DuplicateNameError):
        create_group(db_session, nome="moradia")


def test_create_subcategory_rejects_duplicate_name_within_group(db_session):
    group = create_group(db_session, nome="Moradia")
    create_subcategory(db_session, group_id=group.id, nome="Aluguel", natureza=None)

    with pytest.raises(DuplicateNameError):
        create_subcategory(db_session, group_id=group.id, nome="aluguel", natureza=None)


def test_create_subcategory_allows_same_name_in_different_groups(db_session):
    group_a = create_group(db_session, nome="Moradia")
    group_b = create_group(db_session, nome="Veículos")

    create_subcategory(db_session, group_id=group_a.id, nome="Seguro", natureza=None)
    subcategory_b = create_subcategory(
        db_session, group_id=group_b.id, nome="Seguro", natureza=None
    )

    assert subcategory_b.id is not None


def test_create_subcategory_requires_existing_group(db_session):
    with pytest.raises(NotFoundError):
        create_subcategory(db_session, group_id=999, nome="Aluguel", natureza=None)


def test_create_subcategory_accepts_valid_natureza(db_session):
    group = create_group(db_session, nome="Lazer")
    subcategory = create_subcategory(
        db_session, group_id=group.id, nome="Viagens", natureza=Natureza.eventual
    )

    assert subcategory.natureza == Natureza.eventual
