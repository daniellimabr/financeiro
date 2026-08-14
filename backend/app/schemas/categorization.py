from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.pluggy import (
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)


class PendingTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    user_id: int
    descricao: str
    valor: Decimal
    tipo: PluggyTransactionTipo
    data: date
    status: PluggyTransactionStatus
    categorizacao_status: PluggyTransactionCategorizacaoStatus
    subcategory_id: int | None
    subcategoria_sugerida_id: int | None
    sugestao_confianca: str | None
    sugestao_fonte_tipo: str | None
    sugestao_score: Decimal | None
    asset_id: int | None
    asset_sugerido_id: int | None
    asset_sugestao_confianca: str | None
    created_at: datetime
    updated_at: datetime


class CategorizationConfirmIn(BaseModel):
    subcategory_id: int


class AssetAssociationIn(BaseModel):
    asset_id: int | None = None
