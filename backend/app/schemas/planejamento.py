from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.pluggy import PluggyTransactionTipo


class CelulaGradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ano: int
    mes: int
    valor: Decimal
    origem: str
    realizado_parcial: Decimal | None = None
    status: str | None = None
    transacao_vinculada_id: int | None = None


class LinhaSubcategoriaGradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subcategory_id: int
    subcategory_nome: str
    group_id: int
    group_nome: str
    tipo: PluggyTransactionTipo
    celulas: list[CelulaGradeOut]


class LinhaItemGradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: int
    nome: str
    tipo: PluggyTransactionTipo
    recorrente: bool
    cumprido: bool
    celulas: list[CelulaGradeOut]


class LinhaEventualGradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tipo: PluggyTransactionTipo
    celulas: list[CelulaGradeOut]


class GradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    periodo: list[tuple[int, int]]
    subcategorias: list[LinhaSubcategoriaGradeOut]
    itens: list[LinhaItemGradeOut]
    eventuais: list[LinhaEventualGradeOut]
    total_despesas: list[CelulaGradeOut]
    total_receitas: list[CelulaGradeOut]
    saldo: list[CelulaGradeOut]


class PlanejamentoValorIn(BaseModel):
    ano: int
    mes: int
    valor: Decimal


class PlanejamentoValorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subcategory_id: int
    ano: int
    mes: int
    valor: Decimal


class PlanejamentoValorEventualIn(BaseModel):
    ano: int
    mes: int
    valor: Decimal


class PlanejamentoValorEventualOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: PluggyTransactionTipo
    ano: int
    mes: int
    valor: Decimal


class ItemPlanejadoIn(BaseModel):
    nome: str
    tipo: PluggyTransactionTipo
    valor: Decimal
    data_inicio: date
    recorrente: bool = False
    data_fim: date | None = None

    @model_validator(mode="after")
    def _valida_data_fim(self) -> "ItemPlanejadoIn":
        if self.data_fim is not None and not self.recorrente:
            raise ValueError("data_fim só é válido para item planejado recorrente")
        return self


class ItemPlanejadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    tipo: PluggyTransactionTipo
    valor: Decimal
    data_inicio: date
    recorrente: bool
    data_fim: date | None
    transacao_vinculada_id: int | None


class VincularItemPlanejadoIn(BaseModel):
    transacao_id: int
