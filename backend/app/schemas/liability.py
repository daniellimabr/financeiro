from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.liability import LiabilityStatus, LiabilityTipo


class LiabilityIn(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    tipo: LiabilityTipo
    valor_total: Decimal
    saldo_devedor: Decimal


class LiabilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    nome: str
    tipo: LiabilityTipo
    valor_total: Decimal
    saldo_devedor: Decimal
    status: LiabilityStatus
    data_quitacao: date | None
    created_at: datetime
    updated_at: datetime
