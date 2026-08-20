from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.orcamento import OrcamentoTipo


class OrcamentoIn(BaseModel):
    subcategory_id: int
    tipo: OrcamentoTipo
    valor: Decimal = Field(gt=0)
    ano: int | None = None
    mes: int | None = Field(default=None, ge=1, le=12)
    data_inicio: date | None = None
    data_fim: date | None = None

    @model_validator(mode="after")
    def _valida_campos_por_tipo(self) -> "OrcamentoIn":
        if self.tipo == OrcamentoTipo.eventual:
            if self.ano is None or self.mes is None:
                raise ValueError("Orçamento eventual exige ano e mes")
            if self.data_inicio is not None or self.data_fim is not None:
                raise ValueError("Orçamento eventual não aceita data_inicio/data_fim")
        else:
            if self.data_inicio is None:
                raise ValueError("Orçamento recorrente exige data_inicio")
            if self.ano is not None or self.mes is not None:
                raise ValueError("Orçamento recorrente não aceita ano/mes")
            if self.data_fim is not None and self.data_fim < self.data_inicio:
                raise ValueError("data_fim não pode ser anterior a data_inicio")
        return self


class OrcamentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subcategory_id: int
    tipo: OrcamentoTipo
    valor: Decimal
    ano: int | None
    mes: int | None
    data_inicio: date | None
    data_fim: date | None
    created_at: datetime
    updated_at: datetime
