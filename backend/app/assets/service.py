from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.exceptions import InvalidStateError, NotFoundError
from app.models.asset import Asset, AssetStatus
from app.models.pluggy import PluggyTransaction
from app.schemas.asset import AssetIn


def list_assets(db: Session, user_id: int) -> list[Asset]:
    return db.query(Asset).filter(Asset.user_id == user_id).order_by(Asset.nome).all()


def get_asset(db: Session, user_id: int, asset_id: int) -> Asset:
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.user_id == user_id).one_or_none()
    if asset is None:
        raise NotFoundError(f"Ativo {asset_id} não encontrado")
    return asset


def create_asset(db: Session, user_id: int, payload: AssetIn) -> Asset:
    asset = Asset(
        user_id=user_id,
        nome=payload.nome,
        tipo=payload.tipo,
        valor_atual=payload.valor_atual,
        data_aquisicao=payload.data_aquisicao,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(db: Session, user_id: int, asset_id: int, payload: AssetIn) -> Asset:
    asset = get_asset(db, user_id, asset_id)
    asset.nome = payload.nome
    asset.tipo = payload.tipo
    asset.valor_atual = payload.valor_atual
    asset.data_aquisicao = payload.data_aquisicao
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset(db: Session, user_id: int, asset_id: int) -> None:
    asset = get_asset(db, user_id, asset_id)
    # Preserva o histórico de transação: exclusão nunca leva junto as
    # transações que apontavam para o ativo, só desassocia (FK sem
    # ON DELETE definido rejeitaria a exclusão direta, mas a desassociação é
    # regra de negócio própria, independente do comportamento do banco).
    db.query(PluggyTransaction).filter(
        PluggyTransaction.user_id == user_id, PluggyTransaction.asset_id == asset_id
    ).update({PluggyTransaction.asset_id: None})
    db.query(PluggyTransaction).filter(
        PluggyTransaction.user_id == user_id, PluggyTransaction.asset_sugerido_id == asset_id
    ).update({PluggyTransaction.asset_sugerido_id: None})
    db.delete(asset)
    db.commit()


def sell_asset(
    db: Session, user_id: int, asset_id: int, *, valor_venda: Decimal, data_venda: date
) -> Asset:
    asset = get_asset(db, user_id, asset_id)
    if asset.status != AssetStatus.ativo:
        raise InvalidStateError(f"Ativo {asset_id} já está baixado")
    asset.status = AssetStatus.baixado
    asset.valor_venda = valor_venda
    asset.data_venda = data_venda
    db.commit()
    db.refresh(asset)
    return asset
