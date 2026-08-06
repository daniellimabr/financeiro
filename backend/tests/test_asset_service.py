from datetime import date
from decimal import Decimal

import pytest

from app.assets.service import create_asset, sell_asset
from app.exceptions import InvalidStateError
from app.models.asset import AssetTipo
from app.models.user import User


@pytest.fixture()
def user(db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_sell_asset_marks_status_baixado(db_session, user):
    asset = create_asset(
        db_session,
        user.id,
        nome="Carro",
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
    )

    sold = sell_asset(
        db_session, user.id, asset.id, valor_venda=Decimal("45000.00"), data_venda=date(2026, 8, 1)
    )

    assert sold.status.value == "baixado"
    assert sold.valor_venda == Decimal("45000.00")
    assert sold.data_venda == date(2026, 8, 1)


def test_sell_asset_twice_raises_invalid_state(db_session, user):
    asset = create_asset(
        db_session,
        user.id,
        nome="Carro",
        tipo=AssetTipo.veiculo,
        valor_atual=Decimal("50000.00"),
        data_aquisicao=date(2024, 1, 1),
    )
    sell_asset(
        db_session, user.id, asset.id, valor_venda=Decimal("45000.00"), data_venda=date(2026, 8, 1)
    )

    with pytest.raises(InvalidStateError):
        sell_asset(
            db_session,
            user.id,
            asset.id,
            valor_venda=Decimal("40000.00"),
            data_venda=date(2026, 8, 2),
        )
