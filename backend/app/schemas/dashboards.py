from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.category import Natureza
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


class NaturezaTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    natureza: Natureza
    total: Decimal
    percentual: Decimal


class TendenciaNaturezaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    natureza: Natureza
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


class InvestimentoTotalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    investimento_id: int
    investimento_nome: str
    total: Decimal


class TendenciaInvestimentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    investimento_id: int
    investimento_nome: str
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


class PatrimonioBreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ativos: Decimal
    passivos: Decimal
    saldo_liquido_acumulado: Decimal
    saldo_investimentos: Decimal
    total: Decimal


class PontoProjecaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ano: int
    mes: int
    receita: Decimal
    despesa: Decimal
    saldo: Decimal


class SaldoContaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_id: int
    account_nome: str
    account_tipo: PluggyAccountTipo
    saldo: Decimal
    limite_credito: Decimal | None


class EvolucaoSaldoContaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    account_id: int
    account_nome: str
    account_tipo: PluggyAccountTipo
    saldo_inicial: Decimal
    pontos: list[PontoTendenciaOut]
