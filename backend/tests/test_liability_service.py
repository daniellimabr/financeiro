from decimal import Decimal

import pytest

from app.exceptions import InvalidStateError
from app.liabilities.service import create_liability, settle_liability
from app.models.liability import LiabilityTipo
from app.models.user import User


@pytest.fixture()
def user(db_session):
    user = User(google_sub="google-1", email="a@example.com", name="Alice")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_settle_liability_marks_status_quitado(db_session, user):
    liability = create_liability(
        db_session,
        user.id,
        nome="Financiamento carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )

    settled = settle_liability(db_session, user.id, liability.id)

    assert settled.status.value == "quitado"
    assert settled.data_quitacao is not None


def test_settle_liability_twice_raises_invalid_state(db_session, user):
    liability = create_liability(
        db_session,
        user.id,
        nome="Financiamento carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    settle_liability(db_session, user.id, liability.id)

    with pytest.raises(InvalidStateError):
        settle_liability(db_session, user.id, liability.id)
