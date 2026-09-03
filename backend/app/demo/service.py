from sqlalchemy.orm import Session

from app.demo.seed import seed_demo_data
from app.models.asset import Asset
from app.models.categorization import (
    AssetCategorizationRule,
    CategorizationRule,
    InvestimentoCategorizationRule,
)
from app.models.investimento import Investimento
from app.models.liability import Liability
from app.models.orcamento import Orcamento
from app.models.pluggy import (
    PluggyAccount,
    PluggyInvestment,
    PluggyInvestmentSnapshot,
    PluggyInvestmentTransaction,
    PluggyItem,
    PluggyTransaction,
)
from app.models.user import User

_DEMO_GOOGLE_SUB = "__financeiro_demo_user__"
_DEMO_EMAIL = "demo@financeiro.local"
_DEMO_NAME = "Conta Demo"


def get_or_create_demo_user(db: Session) -> User:
    """Get-or-create idempotente do usuário sentinela da conta demo — só
    alcançável por aqui, nunca via `/auth/google/*` (mesmo padrão de criação
    de `upsert_user_from_google`, mas com `google_sub` sentinela fixo que
    nenhum login Google real pode produzir)."""
    user = db.query(User).filter(User.google_sub == _DEMO_GOOGLE_SUB).one_or_none()
    if user is None:
        user = User(
            google_sub=_DEMO_GOOGLE_SUB,
            email=_DEMO_EMAIL,
            name=_DEMO_NAME,
            is_demo=True,
        )
        db.add(user)
        db.flush()
        seed_demo_data(db, user)
        db.commit()
        db.refresh(user)
    return user


def reset_demo_data(db: Session) -> None:
    """Apaga todo o dado transacional do usuário demo e repopula do zero.
    Não reaproveita `delete_asset`/`delete_liability` (pensados para uso
    interativo item a item, com desassociação de FK) — aqui a exclusão é
    completa, em ordem de dependência, só para `user_id` do usuário demo."""
    user = get_or_create_demo_user(db)
    user_id = user.id

    db.query(PluggyTransaction).filter(PluggyTransaction.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(PluggyInvestmentTransaction).filter(
        PluggyInvestmentTransaction.user_id == user_id
    ).delete(synchronize_session=False)
    db.query(PluggyInvestmentSnapshot).filter(PluggyInvestmentSnapshot.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(PluggyInvestment).filter(PluggyInvestment.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(PluggyAccount).filter(PluggyAccount.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(PluggyItem).filter(PluggyItem.user_id == user_id).delete(synchronize_session=False)

    db.query(CategorizationRule).filter(CategorizationRule.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(AssetCategorizationRule).filter(AssetCategorizationRule.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(InvestimentoCategorizationRule).filter(
        InvestimentoCategorizationRule.user_id == user_id
    ).delete(synchronize_session=False)

    db.query(Asset).filter(Asset.user_id == user_id).delete(synchronize_session=False)
    db.query(Liability).filter(Liability.user_id == user_id).delete(synchronize_session=False)
    db.query(Investimento).filter(Investimento.user_id == user_id).delete(synchronize_session=False)
    db.query(Orcamento).filter(Orcamento.user_id == user_id).delete(synchronize_session=False)
    db.commit()

    seed_demo_data(db, user)
