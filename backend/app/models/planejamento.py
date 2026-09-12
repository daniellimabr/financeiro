from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.pluggy import PluggyTransactionTipo


class PlanejamentoValor(Base):
    """Valor confirmado (aceito da sugestão ou editado) de um mês futuro/atual
    de uma subcategoria — ausência de linha para (user, subcategoria, ano,
    mes) significa que a célula ainda é "sugerida", calculada on-the-fly por
    `_sugestao_media_3_meses` (Sprint 38, PRD-038)."""

    __tablename__ = "planejamento_valores"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "subcategory_id", "ano", "mes", name="uq_planejamento_valor_user_sub_ano_mes"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    subcategory_id: Mapped[int] = mapped_column(
        ForeignKey("subcategories.id"), nullable=False, index=True
    )
    ano: Mapped[int] = mapped_column(nullable=False)
    mes: Mapped[int] = mapped_column(nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlanejamentoValorEventual(Base):
    """Valor confirmado (aceito da sugestão ou editado) de um mês futuro da
    linha-lembrete Eventual, por tipo (débito/crédito) — não tem
    subcategoria própria pois agrega várias. O mês corrente nunca tem
    override: a UI só permite editar a partir do mês seguinte ao corrente
    (correção pós-deploy da Sprint 38, decisão do CEO)."""

    __tablename__ = "planejamento_valores_eventual"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "tipo", "ano", "mes", name="uq_planejamento_valor_eventual_user_tipo_ano_mes"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    tipo: Mapped[PluggyTransactionTipo] = mapped_column(
        Enum(PluggyTransactionTipo, name="pluggy_transaction_tipo"), nullable=False
    )
    ano: Mapped[int] = mapped_column(nullable=False)
    mes: Mapped[int] = mapped_column(nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ItemPlanejado(Base):
    """Lançamento planejado livre, sem subcategoria/histórico obrigatório —
    único (vale só no mês-alvo, `data_inicio`) ou recorrente (`data_inicio`
    até `data_fim`, vazio = até o fim do horizonte de 12 meses exibido).
    Quando a transação real correspondente acontece, pode ser vinculado a ela
    (`transacao_vinculada_id`), passando a "cumprido"."""

    __tablename__ = "itens_planejados"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[PluggyTransactionTipo] = mapped_column(
        Enum(PluggyTransactionTipo, name="pluggy_transaction_tipo"), nullable=False
    )
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    data_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    recorrente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    transacao_vinculada_id: Mapped[int | None] = mapped_column(
        ForeignKey("pluggy_transactions.id"), nullable=True, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
