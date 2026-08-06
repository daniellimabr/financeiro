from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.exceptions import InvalidStateError, NotFoundError
from app.models.liability import Liability, LiabilityStatus, LiabilityTipo


def list_liabilities(db: Session, user_id: int) -> list[Liability]:
    return db.query(Liability).filter(Liability.user_id == user_id).order_by(Liability.nome).all()


def get_liability(db: Session, user_id: int, liability_id: int) -> Liability:
    liability = (
        db.query(Liability)
        .filter(Liability.id == liability_id, Liability.user_id == user_id)
        .one_or_none()
    )
    if liability is None:
        raise NotFoundError(f"Passivo {liability_id} não encontrado")
    return liability


def create_liability(
    db: Session,
    user_id: int,
    *,
    nome: str,
    tipo: LiabilityTipo,
    valor_total: Decimal,
    saldo_devedor: Decimal,
) -> Liability:
    liability = Liability(
        user_id=user_id,
        nome=nome,
        tipo=tipo,
        valor_total=valor_total,
        saldo_devedor=saldo_devedor,
    )
    db.add(liability)
    db.commit()
    db.refresh(liability)
    return liability


def update_liability(
    db: Session,
    user_id: int,
    liability_id: int,
    *,
    nome: str,
    tipo: LiabilityTipo,
    valor_total: Decimal,
    saldo_devedor: Decimal,
) -> Liability:
    liability = get_liability(db, user_id, liability_id)
    liability.nome = nome
    liability.tipo = tipo
    liability.valor_total = valor_total
    liability.saldo_devedor = saldo_devedor
    db.commit()
    db.refresh(liability)
    return liability


def delete_liability(db: Session, user_id: int, liability_id: int) -> None:
    liability = get_liability(db, user_id, liability_id)
    db.delete(liability)
    db.commit()


def settle_liability(db: Session, user_id: int, liability_id: int) -> Liability:
    liability = get_liability(db, user_id, liability_id)
    if liability.status != LiabilityStatus.ativo:
        raise InvalidStateError(f"Passivo {liability_id} já está quitado")
    liability.status = LiabilityStatus.quitado
    liability.data_quitacao = date.today()
    db.commit()
    db.refresh(liability)
    return liability
