import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class PluggyItemStatus(enum.StrEnum):
    updating = "updating"
    updated = "updated"
    login_error = "login_error"
    waiting_user_input = "waiting_user_input"
    outdated = "outdated"
    error = "error"


class PluggyAccountTipo(enum.StrEnum):
    corrente = "corrente"
    poupanca = "poupanca"
    cartao_credito = "cartao_credito"
    investimento = "investimento"


class PluggyTransactionTipo(enum.StrEnum):
    debito = "debito"
    credito = "credito"


class PluggyTransactionStatus(enum.StrEnum):
    pendente = "pendente"
    efetivada = "efetivada"


class PluggyItem(Base):
    __tablename__ = "pluggy_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    pluggy_item_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    connector_id: Mapped[int] = mapped_column(nullable=False)
    connector_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[PluggyItemStatus] = mapped_column(
        Enum(PluggyItemStatus, name="pluggy_item_status"), nullable=False
    )
    status_detail: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cutoff_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    accounts: Mapped[list["PluggyAccount"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )


class PluggyAccount(Base):
    __tablename__ = "pluggy_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("pluggy_items.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    pluggy_account_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    tipo: Mapped[PluggyAccountTipo] = mapped_column(
        Enum(PluggyAccountTipo, name="pluggy_account_tipo"), nullable=False
    )
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    numero_mascarado: Mapped[str | None] = mapped_column(String(50), nullable=True)
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moeda: Mapped[str] = mapped_column(String(10), nullable=False, default="BRL")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    item: Mapped["PluggyItem"] = relationship(back_populates="accounts")
    transactions: Mapped[list["PluggyTransaction"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class PluggyTransaction(Base):
    __tablename__ = "pluggy_transactions"
    __table_args__ = (Index("ix_pluggy_transactions_account_id_data", "account_id", "data"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("pluggy_accounts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    pluggy_transaction_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tipo: Mapped[PluggyTransactionTipo] = mapped_column(
        Enum(PluggyTransactionTipo, name="pluggy_transaction_tipo"), nullable=False
    )
    data: Mapped[date] = mapped_column(Date, nullable=False)
    data_competencia: Mapped[date | None] = mapped_column(Date, nullable=True)
    subcategory_id: Mapped[int | None] = mapped_column(
        ForeignKey("subcategories.id"), nullable=True
    )
    categoria_pluggy: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[PluggyTransactionStatus] = mapped_column(
        Enum(PluggyTransactionStatus, name="pluggy_transaction_status"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped["PluggyAccount"] = relationship(back_populates="transactions")
