from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.dashboards import service
from app.db import get_db
from app.models.pluggy import PluggyTransactionTipo
from app.models.user import User
from app.schemas.dashboards import CategoriaTotalOut, MeioPagamentoTotalOut, SummaryOut

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
