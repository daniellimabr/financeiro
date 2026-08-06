import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AssetTipo(enum.StrEnum):
    imovel = "imovel"
    veiculo = "veiculo"
    outro = "outro"


class AssetStatus(enum.StrEnum):
    ativo = "ativo"
    baixado = "baixado"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[AssetTipo] = mapped_column(Enum(AssetTipo, name="asset_tipo"), nullable=False)
    valor_atual: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    data_aquisicao: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, name="asset_status"), nullable=False, default=AssetStatus.ativo
    )
    data_venda: Mapped[date | None] = mapped_column(Date, nullable=True)
    valor_venda: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
