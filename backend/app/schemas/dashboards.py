from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.pluggy import PluggyAccountTipo


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    receita: Decimal
    despesa: Decimal
    saldo: Decimal
    patrimonio: Decimal


class CategoriaTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group_id: int
    group_nome: str
    subcategory_id: int
    subcategory_nome: str
    total: Decimal


class MeioPagamentoTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_tipo: PluggyAccountTipo
    total: Decimal
