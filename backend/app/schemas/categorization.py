from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.pluggy import (
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    user_id: int
    descricao: str
    descricao_usuario: str | None
    descricao_sugerida: str | None
    descricao_sugestao_origem_id: int | None
    valor: Decimal
    tipo: PluggyTransactionTipo
    data: date
    data_editada_manualmente: bool
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
    liability_id: int | None
    liability_sugerido_id: int | None
    liability_sugestao_confianca: str | None
    created_at: datetime
    updated_at: datetime


class TransactionsPageOut(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int


class CategoryIn(BaseModel):
    subcategory_id: int


class AssetAssociationIn(BaseModel):
    asset_id: int | None = None


class LiabilityAssociationIn(BaseModel):
    liability_id: int | None = None


class BulkConfirmItemIn(BaseModel):
    transaction_id: int
    subcategory_id: int


class BulkConfirmIn(BaseModel):
    items: list[BulkConfirmItemIn] = Field(min_length=1)


class BulkConfirmResultOut(BaseModel):
    transaction_id: int
    success: bool
    error: str | None = None


class BulkConfirmOut(BaseModel):
    results: list[BulkConfirmResultOut]


class DescriptionUpdateIn(BaseModel):
    descricao: str = Field(min_length=1, max_length=500)


class DescriptionUpdateOut(BaseModel):
    transaction: TransactionOut
    propagated: int


class DateUpdateIn(BaseModel):
    data: date
