from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.asset import AssetStatus, AssetTipo


class AssetIn(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    tipo: AssetTipo
    valor_atual: Decimal
    data_aquisicao: date


class AssetSellIn(BaseModel):
    valor_venda: Decimal
    data_venda: date


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    nome: str
    tipo: AssetTipo
    valor_atual: Decimal
    data_aquisicao: date
    status: AssetStatus
    data_venda: date | None
    valor_venda: Decimal | None
    created_at: datetime
    updated_at: datetime
