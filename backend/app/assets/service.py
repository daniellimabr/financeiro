from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.exceptions import InvalidStateError, NotFoundError
from app.models.asset import Asset, AssetStatus, AssetTipo


def list_assets(db: Session, user_id: int) -> list[Asset]:
    return db.query(Asset).filter(Asset.user_id == user_id).order_by(Asset.nome).all()


def get_asset(db: Session, user_id: int, asset_id: int) -> Asset:
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.user_id == user_id).one_or_none()
    if asset is None:
        raise NotFoundError(f"Ativo {asset_id} não encontrado")
    return asset


def create_asset(
    db: Session,
    user_id: int,
    *,
    nome: str,
    tipo: AssetTipo,
    valor_atual: Decimal,
    data_aquisicao: date,
) -> Asset:
    asset = Asset(
        user_id=user_id,
        nome=nome,
        tipo=tipo,
        valor_atual=valor_atual,
        data_aquisicao=data_aquisicao,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(
    db: Session,
    user_id: int,
    asset_id: int,
    *,
    nome: str,
    tipo: AssetTipo,
    valor_atual: Decimal,
    data_aquisicao: date,
) -> Asset:
    asset = get_asset(db, user_id, asset_id)
    asset.nome = nome
    asset.tipo = tipo
    asset.valor_atual = valor_atual
    asset.data_aquisicao = data_aquisicao
    db.commit()
    db.refresh(asset)
    return asset


def delete_asset(db: Session, user_id: int, asset_id: int) -> None:
    asset = get_asset(db, user_id, asset_id)
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
