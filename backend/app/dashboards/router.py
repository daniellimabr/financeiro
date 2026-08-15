from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.dashboards import service
from app.db import get_db
from app.models.pluggy import PluggyTransactionTipo
from app.models.user import User
from app.schemas.dashboards import (
    AtivoTotalOut,
    CategoriaTotalOut,
    MeioPagamentoTotalOut,
    SummaryOut,
    TendenciaAtivoOut,
    TendenciaCategoriaOut,
    TendenciaMesOut,
)

router = APIRouter(prefix="/dashboards")


@router.get("/summary", response_model=SummaryOut)
def get_summary(
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_summary(db, current_user.id, ano=ano, mes=mes)


@router.get("/por-categoria", response_model=list[CategoriaTotalOut])
def get_por_categoria(
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_categoria(db, current_user.id, tipo=tipo, ano=ano, mes=mes)


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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia(db, current_user.id, ano=ano, mes=mes, meses=meses)


@router.get("/por-categoria/tendencia", response_model=list[TendenciaCategoriaOut])
def get_por_categoria_tendencia(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia_por_categoria(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, meses=meses
    )


@router.get("/por-ativo", response_model=list[AtivoTotalOut])
def get_por_ativo(
    tipo: PluggyTransactionTipo,
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_por_ativo(db, current_user.id, tipo=tipo, ano=ano, mes=mes)


@router.get("/por-ativo/tendencia", response_model=list[TendenciaAtivoOut])
def get_por_ativo_tendencia(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    meses: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_tendencia_por_ativo(
        db, current_user.id, tipo=tipo, ano=ano, mes=mes, meses=meses
    )
