import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
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


class PluggyTransactionCategorizacaoStatus(enum.StrEnum):
    pendente = "pendente"
    confirmada = "confirmada"


# Proventos/taxas de investimentos administrados (dividendo, JCP, IRRF sobre
# rendimento, taxa de intermediação) chegam via conta corrente vinculada à
# corretora (ex.: XP), nunca por uma conta tipo=investimento (achado real do
# Bloco 0 da Sprint 22: XP não retorna nenhuma conta desse tipo, só holdings
# via /investments). `categoria_pluggy` é o sinal que a própria Pluggy usa pra
# marcar esse fluxo — distinto de "Investments" (aporte/resgate manual, que o
# CEO decidiu continuar controlando pela transação de conta corrente, Sprint
# 19) — por isso a exclusão é por categoria, não por tipo de conta. Compartilhada
# entre dashboards (totais) e categorization (fila) para não divergir.
INVESTIMENTO_PROVENTOS_CATEGORIAS_PLUGGY = {
    "Proceeds interests and dividends",
    "Taxes on investments",
}


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
    apelido: Mapped[str | None] = mapped_column(String(255), nullable=True)
    numero_mascarado: Mapped[str | None] = mapped_column(String(50), nullable=True)
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    moeda: Mapped[str] = mapped_column(String(10), nullable=False, default="BRL")
    sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    limite_credito: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    fatura_vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    saldo_inicial: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    investimento_id: Mapped[int | None] = mapped_column(
        ForeignKey("investimentos.id"), nullable=True
    )
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
    __table_args__ = (
        Index("ix_pluggy_transactions_account_id_data", "account_id", "data"),
        Index(
            "ix_pluggy_transactions_user_id_categorizacao_status",
            "user_id",
            "categorizacao_status",
        ),
        Index(
            "ix_pluggy_transactions_user_id_data_competencia",
            "user_id",
            "data_competencia",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("pluggy_accounts.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    pluggy_transaction_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    descricao: Mapped[str] = mapped_column(String(500), nullable=False)
    descricao_usuario: Mapped[str | None] = mapped_column(String(500), nullable=True)
    descricao_sugerida: Mapped[str | None] = mapped_column(String(500), nullable=True)
    descricao_sugestao_origem_id: Mapped[int | None] = mapped_column(
        ForeignKey("pluggy_transactions.id"), nullable=True
    )
    valor: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    tipo: Mapped[PluggyTransactionTipo] = mapped_column(
        Enum(PluggyTransactionTipo, name="pluggy_transaction_tipo"), nullable=False
    )
    data: Mapped[date] = mapped_column(Date, nullable=False)
    data_competencia: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_caixa: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_editada_manualmente: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    subcategory_id: Mapped[int | None] = mapped_column(
        ForeignKey("subcategories.id"), nullable=True
    )
    categoria_pluggy: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[PluggyTransactionStatus] = mapped_column(
        Enum(PluggyTransactionStatus, name="pluggy_transaction_status"), nullable=False
    )
    categorizacao_status: Mapped[PluggyTransactionCategorizacaoStatus] = mapped_column(
        Enum(PluggyTransactionCategorizacaoStatus, name="pluggy_transaction_categorizacao_status"),
        nullable=False,
        default=PluggyTransactionCategorizacaoStatus.pendente,
    )
    subcategoria_sugerida_id: Mapped[int | None] = mapped_column(
        ForeignKey("subcategories.id"), nullable=True
    )
    sugestao_confianca: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sugestao_fonte_tipo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sugestao_fonte_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sugestao_score: Mapped[Decimal | None] = mapped_column(Numeric(4, 3), nullable=True)
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    asset_sugerido_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), nullable=True)
    asset_sugestao_confianca: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # True assim que o usuário escolhe manualmente o vínculo de ativo (mesmo
    # que a escolha seja "nenhum") — impede que _apply_suggestions reponha
    # asset_sugerido_id a cada recarga da lista enquanto a transação segue
    # pendente (achado real: usuário não conseguia desvincular um investimento
    # porque a sugestão de histórico voltava sempre).
    asset_confirmado_manualmente: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    liability_id: Mapped[int | None] = mapped_column(ForeignKey("liabilities.id"), nullable=True)
    liability_sugerido_id: Mapped[int | None] = mapped_column(
        ForeignKey("liabilities.id"), nullable=True
    )
    liability_sugestao_confianca: Mapped[str | None] = mapped_column(String(20), nullable=True)
    liability_confirmado_manualmente: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    investimento_id: Mapped[int | None] = mapped_column(
        ForeignKey("investimentos.id"), nullable=True
    )
    investimento_sugerido_id: Mapped[int | None] = mapped_column(
        ForeignKey("investimentos.id"), nullable=True
    )
    investimento_sugestao_confianca: Mapped[str | None] = mapped_column(String(20), nullable=True)
    investimento_confirmado_manualmente: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped["PluggyAccount"] = relationship(back_populates="transactions")

    @property
    def account_tipo(self) -> "PluggyAccountTipo":
        return self.account.tipo


class PluggyInvestment(Base):
    __tablename__ = "pluggy_investments"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("pluggy_items.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    pluggy_investment_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # `tipo`/`subtipo` livres (String, não Enum) — taxonomia de investimento da
    # Pluggy (ex.: FIXED_INCOME/CDB, EQUITY/STOCK, achado real do Bloco 1) é
    # maior e mais volátil que PluggyAccountTipo; um enum forçaria migration a
    # cada tipo novo retornado pela Pluggy.
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    subtipo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    codigo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Numeric(20, 8): payload real do Bloco 1 tem quantidade de CDB com até 7
    # casas decimais (ex.: 1967409.5229) — Numeric(14,2) truncaria.
    quantidade: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    valor_investido: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    valor_atual: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    saldo_inicial: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    moeda: Mapped[str] = mapped_column(String(10), nullable=False, default="BRL")
    investimento_id: Mapped[int | None] = mapped_column(
        ForeignKey("investimentos.id"), nullable=True
    )
    investimento_sugerido_id: Mapped[int | None] = mapped_column(
        ForeignKey("investimentos.id"), nullable=True
    )
    investimento_sugestao_confianca: Mapped[str | None] = mapped_column(String(20), nullable=True)
    investimento_sugestao_fonte_tipo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    investimento_sugestao_fonte_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    investimento_sugestao_score: Mapped[Decimal | None] = mapped_column(
        Numeric(4, 3), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    transactions: Mapped[list["PluggyInvestmentTransaction"]] = relationship(
        back_populates="investment", cascade="all, delete-orphan"
    )
    snapshots: Mapped[list["PluggyInvestmentSnapshot"]] = relationship(
        back_populates="investment", cascade="all, delete-orphan"
    )


class PluggyInvestmentTransaction(Base):
    __tablename__ = "pluggy_investment_transactions"
    __table_args__ = (
        Index("ix_pluggy_investment_transactions_investment_id_data", "investment_id", "data"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    investment_id: Mapped[int] = mapped_column(ForeignKey("pluggy_investments.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    pluggy_investment_transaction_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True
    )
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    valor: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    quantidade: Mapped[Decimal | None] = mapped_column(Numeric(20, 8), nullable=True)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    investment: Mapped["PluggyInvestment"] = relationship(back_populates="transactions")


class PluggyInvestmentSnapshot(Base):
    """Snapshot mensal de saldo/valorização/rendimento por holding (Sprint 21).

    Meses fechados são imutáveis uma vez gravados; o mês corrente pode ser
    regravado a cada sync até fechar (idempotência via UniqueConstraint
    (investment_id, ano_mes), upsert no job/reconstrução).
    """

    __tablename__ = "pluggy_investment_snapshots"
    __table_args__ = (
        Index("ux_pluggy_investment_snapshots_inv_mes", "investment_id", "ano_mes", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    investment_id: Mapped[int] = mapped_column(ForeignKey("pluggy_investments.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # "YYYY-MM" — string simples, o mesmo mês nunca precisa de aritmética de
    # data, só igualdade/ordenação lexicográfica (que já funciona pro formato).
    ano_mes: Mapped[str] = mapped_column(String(7), nullable=False)
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    valorizacao: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0")
    )
    rendimento: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0")
    )
    # Só preenchido para holdings EQUITY (achado do Bloco 0: FIXED_INCOME nunca
    # reporta transação de dividendo/cupom separada).
    dividendos: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    aportes: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    resgates: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    confianca: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    investment: Mapped["PluggyInvestment"] = relationship(back_populates="snapshots")
