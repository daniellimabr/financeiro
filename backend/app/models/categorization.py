from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "padrao_normalizado", name="uq_categorization_rule_user_padrao"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subcategory_id: Mapped[int] = mapped_column(ForeignKey("subcategories.id"), nullable=False)
    padrao_descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    padrao_normalizado: Mapped[str] = mapped_column(String(500), nullable=False)
    origem: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AssetCategorizationRule(Base):
    __tablename__ = "asset_categorization_rules"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "padrao_normalizado", name="uq_asset_categorization_rule_user_padrao"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), nullable=False)
    padrao_descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    padrao_normalizado: Mapped[str] = mapped_column(String(500), nullable=False)
    origem: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvestimentoCategorizationRule(Base):
    __tablename__ = "investimento_categorization_rules"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "padrao_normalizado",
            name="uq_investimento_categorization_rule_user_padrao",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    investimento_id: Mapped[int] = mapped_column(ForeignKey("investimentos.id"), nullable=False)
    padrao_descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    padrao_normalizado: Mapped[str] = mapped_column(String(500), nullable=False)
    origem: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
