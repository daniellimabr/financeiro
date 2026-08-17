from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InvestimentoIn(BaseModel):
    nome: str = Field(min_length=1, max_length=255)


class InvestimentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    nome: str
    created_at: datetime
    updated_at: datetime


class InvestimentoEvolucaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    saldo_base: Decimal
    saldo_atual: Decimal
    total_aportes: Decimal
    total_resgates: Decimal
    rendimento_estimado: Decimal
