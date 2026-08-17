from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.pluggy import (
    PluggyAccountTipo,
    PluggyItemStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)


class ConnectTokenIn(BaseModel):
    item_id: str | None = None


class ConnectTokenOut(BaseModel):
    access_token: str


class PluggyItemIn(BaseModel):
    pluggy_item_id: str = Field(min_length=1, max_length=255)


class PluggyItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    pluggy_item_id: str
    connector_id: int
    connector_name: str
    status: PluggyItemStatus
    status_detail: str | None
    cutoff_date: date
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PluggyAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    user_id: int
    pluggy_account_id: str
    tipo: PluggyAccountTipo
    nome: str
    apelido: str | None
    numero_mascarado: str | None
    saldo: Decimal
    moeda: str
    sync_enabled: bool
    saldo_inicial: Decimal | None
    created_at: datetime
    updated_at: datetime


class PluggyAccountUpdateIn(BaseModel):
    apelido: str | None = None
    sync_enabled: bool = True


class PluggyAccountSaldoInicialIn(BaseModel):
    saldo_inicial: Decimal | None = None


class SalarioAjusteDezembroIn(BaseModel):
    account_id: int
    data: date
    valor: Decimal | None = None


class SalarioAjusteDezembroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_id: int
    data: date
    valor: Decimal


class SyncItemsIn(BaseModel):
    item_ids: list[int] | None = None


class SyncItemResultOut(BaseModel):
    item_id: int
    success: bool
    error: str | None = None
    item: PluggyItemOut | None = None


class SyncItemsOut(BaseModel):
    results: list[SyncItemResultOut]


class PluggyTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    user_id: int
    pluggy_transaction_id: str
    descricao: str
    descricao_usuario: str | None
    descricao_sugerida: str | None
    valor: Decimal
    tipo: PluggyTransactionTipo
    data: date
    data_competencia: date | None
    data_editada_manualmente: bool
    subcategory_id: int | None
    subcategoria_sugerida_id: int | None
    categoria_pluggy: str | None
    status: PluggyTransactionStatus
    account_tipo: PluggyAccountTipo
    asset_id: int | None
    asset_sugerido_id: int | None
    created_at: datetime
    updated_at: datetime
