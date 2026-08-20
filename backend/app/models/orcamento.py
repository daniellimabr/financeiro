import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class OrcamentoTipo(enum.StrEnum):
    eventual = "eventual"
    recorrente = "recorrente"


class Orcamento(Base):
    __tablename__ = "orcamentos"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subcategory_id: Mapped[int] = mapped_column(
        ForeignKey("subcategories.id"), nullable=False, index=True
    )
    tipo: Mapped[OrcamentoTipo] = mapped_column(
        Enum(OrcamentoTipo, name="orcamento_tipo"), nullable=False
    )
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    ano: Mapped[int | None] = mapped_column(nullable=True)
    mes: Mapped[int | None] = mapped_column(nullable=True)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
