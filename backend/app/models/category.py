import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# Sentinel usado nos filtros de categoria dos endpoints de dashboards e de
# listagem de transações para representar "sem subcategoria atribuída". IDs
# reais de subcategory são autoincrement a partir de 1, então 0 nunca colide.
SEM_CATEGORIA_ID = 0


class Natureza(enum.StrEnum):
    fixa = "fixa"
    variavel = "variavel"
    eventual = "eventual"


class CategoryGroup(Base):
    __tablename__ = "category_groups"
    __table_args__ = (UniqueConstraint("user_id", "nome", name="uq_category_group_user_nome"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), index=True)
    excluir_de_totais: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    subcategories: Mapped[list["Subcategory"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class Subcategory(Base):
    __tablename__ = "subcategories"
    __table_args__ = (UniqueConstraint("group_id", "nome", name="uq_subcategory_group_nome"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("category_groups.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    natureza: Mapped[Natureza | None] = mapped_column(
        Enum(Natureza, name="natureza"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    group: Mapped["CategoryGroup"] = relationship(back_populates="subcategories")
