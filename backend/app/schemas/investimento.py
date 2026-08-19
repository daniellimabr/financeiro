from datetime import date, datetime
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


class InvestimentoComValorAtualOut(InvestimentoOut):
    # Valor atual agregado (contas + holdings vinculadas), pronto pro
    # drilldown do card Ativos/Patrimônio — GET /investimentos continua
    # servindo CRUD (create/update/get retornam InvestimentoOut sem esse
    # campo, calculado só na listagem).
    valor_atual: Decimal


class InvestimentoEvolucaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    saldo_base: Decimal
    saldo_atual: Decimal
    total_aportes: Decimal
    total_resgates: Decimal
    rendimento_estimado: Decimal


class EvolucaoMensalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ano_mes: str
    saldo: Decimal
    valorizacao: Decimal
    rendimento: Decimal
    dividendos: Decimal
    aportes: Decimal
    resgates: Decimal
    confianca: str


class InvestimentoTransacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    data: date
    tipo: str
    descricao: str | None
    valor: Decimal
    origem: str
    holding_nome: str | None
