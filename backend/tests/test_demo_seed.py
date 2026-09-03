from app.demo.seed import seed_demo_data
from app.demo.service import get_or_create_demo_user, reset_demo_data
from app.models.asset import Asset
from app.models.category import CategoryGroup, Subcategory
from app.models.investimento import Investimento
from app.models.liability import Liability
from app.models.orcamento import Orcamento
from app.models.pluggy import (
    PluggyAccount,
    PluggyInvestment,
    PluggyInvestmentSnapshot,
    PluggyItem,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
)
from app.models.user import User


def _make_demo_user(db_session) -> User:
    user = User(google_sub="demo-seed-test", email="demo-seed@example.com", name="Demo")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_seed_demo_data_creates_minimum_counts_per_entity(db_session):
    user = _make_demo_user(db_session)

    seed_demo_data(db_session, user)

    assert db_session.query(PluggyItem).filter(PluggyItem.user_id == user.id).count() == 1
    assert db_session.query(PluggyAccount).filter(PluggyAccount.user_id == user.id).count() == 4
    assert db_session.query(Investimento).filter(Investimento.user_id == user.id).count() == 2
    assert (
        db_session.query(PluggyInvestment).filter(PluggyInvestment.user_id == user.id).count() == 2
    )
    assert (
        db_session.query(PluggyInvestmentSnapshot)
        .filter(PluggyInvestmentSnapshot.user_id == user.id)
        .count()
        == 18
    )
    assert db_session.query(Asset).filter(Asset.user_id == user.id).count() >= 2
    assert db_session.query(Liability).filter(Liability.user_id == user.id).count() >= 1
    assert db_session.query(Orcamento).filter(Orcamento.user_id == user.id).count() >= 1

    transactions = (
        db_session.query(PluggyTransaction).filter(PluggyTransaction.user_id == user.id).all()
    )
    assert len(transactions) > 100

    pendentes = [
        tx
        for tx in transactions
        if tx.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente
    ]
    confirmadas = [
        tx
        for tx in transactions
        if tx.categorizacao_status == PluggyTransactionCategorizacaoStatus.confirmada
    ]
    assert len(pendentes) > 0
    assert len(confirmadas) > 0

    groups = db_session.query(CategoryGroup).filter(CategoryGroup.user_id == user.id).count()
    subcategories = db_session.query(Subcategory).filter(Subcategory.user_id == user.id).count()
    assert groups > 0
    assert subcategories > 0


def test_seed_demo_data_is_isolated_per_user(db_session):
    demo_user = _make_demo_user(db_session)
    other_user = User(google_sub="other-user", email="other@example.com", name="Other")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    seed_demo_data(db_session, demo_user)

    assert (
        db_session.query(PluggyTransaction)
        .filter(PluggyTransaction.user_id == other_user.id)
        .count()
        == 0
    )
    assert db_session.query(Asset).filter(Asset.user_id == other_user.id).count() == 0


def test_reset_demo_data_leaves_no_orphan_rows(db_session):
    user = get_or_create_demo_user(db_session)

    count_before = (
        db_session.query(PluggyTransaction).filter(PluggyTransaction.user_id == user.id).count()
    )

    reset_demo_data(db_session)

    count_after = (
        db_session.query(PluggyTransaction).filter(PluggyTransaction.user_id == user.id).count()
    )
    assert count_after == count_before

    # Nenhuma transação deve sobrar apontando para uma conta/item já apagado
    # na rodada anterior de reset (achado de risco do plano: "lixo órfão").
    account_ids = {
        row[0]
        for row in db_session.query(PluggyAccount.id).filter(PluggyAccount.user_id == user.id)
    }
    transaction_account_ids = {
        row[0]
        for row in db_session.query(PluggyTransaction.account_id).filter(
            PluggyTransaction.user_id == user.id
        )
    }
    assert transaction_account_ids.issubset(account_ids)
