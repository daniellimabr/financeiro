from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.pluggy import PluggyAccountTipo


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    receita: Decimal
    despesa: Decimal
    saldo: Decimal
    patrimonio: Decimal
    ativos: Decimal
    passivos: Decimal


class CategoriaTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group_id: int
    group_nome: str
    subcategory_id: int
    subcategory_nome: str
    total: Decimal
    percentual: Decimal


class MeioPagamentoTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_tipo: PluggyAccountTipo
    total: Decimal
    percentual: Decimal


class TendenciaMesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ano: int
    mes: int
    receita: Decimal
    despesa: Decimal
    saldo: Decimal


class PontoTendenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ano: int
    mes: int
    total: Decimal


class TendenciaCategoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subcategory_id: int
    subcategory_nome: str
    pontos: list[PontoTendenciaOut]


class AtivoTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int
    asset_nome: str
    total: Decimal


class TendenciaAtivoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int
    asset_nome: str
    pontos: list[PontoTendenciaOut]


class PassivoTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    liability_id: int
    liability_nome: str
    total: Decimal


class TendenciaPassivoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    liability_id: int
    liability_nome: str
    pontos: list[PontoTendenciaOut]


class SaldoContaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_id: int
    account_nome: str
    account_tipo: PluggyAccountTipo
    saldo: Decimal
