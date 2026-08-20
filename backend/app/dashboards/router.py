from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.dashboards import service
from app.dashboards.service import Regime
from app.db import get_db
from app.models.pluggy import PluggyTransactionTipo
from app.models.user import User
from app.schemas.dashboards import (
    AtivoTotalOut,
    CategoriaTotalOut,
    EvolucaoSaldoContaOut,
    InvestimentoTotalOut,
    LinhaConferenciaSaldoOut,
    MeioPagamentoTotalOut,
    NaturezaTotalOut,
    OrcamentoStatusOut,
    PassivoTotalOut,
    PatrimonioBreakdownOut,
    PontoTendenciaOut,
    SaldoContaOut,
    SummaryOut,
    TendenciaAtivoOut,
    TendenciaCategoriaOut,
    TendenciaInvestimentoOut,
    TendenciaMesOut,
    TendenciaNaturezaOut,
    TendenciaPassivoOut,
)

router = APIRouter(prefix="/dashboards")


@router.get("/summary", response_model=SummaryOut)
def get_summary(
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_summary(db, current_user.id, ano=ano, mes=mes, regime=regime)


@router.get("/patrimonio/breakdown", response_model=PatrimonioBreakdownOut)
def get_patrimonio_breakdown(
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_patrimonio_breakdown(db, current_user.id, regime=regime)


@router.get("/por-categoria", response_model=list[CategoriaTotalOut])
def get_por_categoria(
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_categoria(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, regime=regime
    )


@router.get("/por-meio-pagamento", response_model=list[MeioPagamentoTotalOut])
def get_por_meio_pagamento(
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    categoria_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_meio_pagamento(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, categoria_id=categoria_id
    )


@router.get("/tendencia", response_model=list[TendenciaMesOut])
def get_tendencia(
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia(db, current_user.id, ano=ano, mes=mes, meses=meses, regime=regime)


@router.get("/por-categoria/tendencia", response_model=list[TendenciaCategoriaOut])
def get_por_categoria_tendencia(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia_por_categoria(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, meses=meses, regime=regime
    )


@router.get("/por-natureza", response_model=list[NaturezaTotalOut])
def get_por_natureza(
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_natureza(db, current_user.id, tipo=tipo, ano=ano, mes=mes)


@router.get("/por-natureza/tendencia", response_model=list[TendenciaNaturezaOut])
def get_por_natureza_tendencia(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia_por_natureza(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, meses=meses
    )


@router.get("/por-ativo", response_model=list[AtivoTotalOut])
def get_por_ativo(
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_ativo(db, current_user.id, tipo=tipo, ano=ano, mes=mes, regime=regime)


@router.get("/por-ativo/tendencia", response_model=list[TendenciaAtivoOut])
def get_por_ativo_tendencia(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia_por_ativo(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, meses=meses, regime=regime
    )


@router.get("/por-investimento", response_model=list[InvestimentoTotalOut])
def get_por_investimento(
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_investimento(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, regime=regime
    )


@router.get("/por-investimento/tendencia", response_model=list[TendenciaInvestimentoOut])
def get_por_investimento_tendencia(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia_por_investimento(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, meses=meses, regime=regime
    )


@router.get("/por-passivo", response_model=list[PassivoTotalOut])
def get_por_passivo(
    ano: int | None = None,
    mes: int | None = None,
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_passivo(db, current_user.id, ano=ano, mes=mes, regime=regime)


@router.get("/por-passivo/tendencia", response_model=list[TendenciaPassivoOut])
def get_por_passivo_tendencia(
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia_por_passivo(
        db, current_user.id, ano=ano, mes=mes, meses=meses, regime=regime
    )


@router.get("/por-orcamento", response_model=list[OrcamentoStatusOut])
def get_por_orcamento(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    regime: Regime = "competencia",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_orcamento_status(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, regime=regime
    )


@router.get("/saldo-por-conta", response_model=list[SaldoContaOut])
def get_saldo_por_conta(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_saldo_por_conta(db, current_user.id)


@router.get("/evolucao-saldo-por-conta", response_model=list[EvolucaoSaldoContaOut])
def get_evolucao_saldo_por_conta(
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_evolucao_saldo_por_conta(db, current_user.id, ano=ano, mes=mes, meses=meses)


@router.get("/saldo-acumulado", response_model=list[PontoTendenciaOut])
def get_saldo_acumulado(
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_saldo_acumulado(db, current_user.id, ano=ano, mes=mes, meses=meses)


@router.get("/saldo-acumulado/conferencia", response_model=list[LinhaConferenciaSaldoOut])
def get_saldo_acumulado_conferencia(
    ano: int,
    mes: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_saldo_acumulado_conferencia(db, current_user.id, ano=ano, mes=mes)
