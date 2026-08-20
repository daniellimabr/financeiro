from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.exceptions import NotFoundError
from app.models.user import User
from app.orcamentos import service
from app.schemas.orcamento import OrcamentoIn, OrcamentoOut

router = APIRouter(prefix="/orcamentos")


@router.get("", response_model=list[OrcamentoOut])
def list_orcamentos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_orcamentos(db, current_user.id)


@router.post("", response_model=OrcamentoOut, status_code=status.HTTP_201_CREATED)
def create_orcamento(
    payload: OrcamentoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create_orcamento(
            db,
            current_user.id,
            subcategory_id=payload.subcategory_id,
            tipo=payload.tipo,
            valor=payload.valor,
            ano=payload.ano,
            mes=payload.mes,
            data_inicio=payload.data_inicio,
            data_fim=payload.data_fim,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{orcamento_id}", response_model=OrcamentoOut)
def update_orcamento(
    orcamento_id: int,
    payload: OrcamentoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_orcamento(
            db,
            current_user.id,
            orcamento_id,
            subcategory_id=payload.subcategory_id,
            tipo=payload.tipo,
            valor=payload.valor,
            ano=payload.ano,
            mes=payload.mes,
            data_inicio=payload.data_inicio,
            data_fim=payload.data_fim,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{orcamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_orcamento(
    orcamento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete_orcamento(db, current_user.id, orcamento_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
