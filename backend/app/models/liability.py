import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LiabilityTipo(enum.StrEnum):
    financiamento = "financiamento"
    outro = "outro"


class LiabilityStatus(enum.StrEnum):
    ativo = "ativo"
    quitado = "quitado"


class Liability(Base):
    __tablename__ = "liabilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[LiabilityTipo] = mapped_column(
        Enum(LiabilityTipo, name="liability_tipo"), nullable=False
    )
    valor_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    saldo_devedor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    status: Mapped[LiabilityStatus] = mapped_column(
        Enum(LiabilityStatus, name="liability_status"),
        nullable=False,
        default=LiabilityStatus.ativo,
    )
    data_quitacao: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
