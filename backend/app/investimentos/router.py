from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.exceptions import NotFoundError
from app.investimentos import service
from app.models.user import User
from app.schemas.investimento import (
    EvolucaoMensalOut,
    InvestimentoEvolucaoOut,
    InvestimentoIn,
    InvestimentoOut,
)

router = APIRouter(prefix="/investimentos")


@router.get("", response_model=list[InvestimentoOut])
def list_investimentos(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return service.list_investimentos(db, current_user.id)


@router.post("", response_model=InvestimentoOut, status_code=status.HTTP_201_CREATED)
def create_investimento(
    payload: InvestimentoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_investimento(db, current_user.id, nome=payload.nome)


@router.get("/{investimento_id}", response_model=InvestimentoOut)
def get_investimento(
    investimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.get_investimento(db, current_user.id, investimento_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{investimento_id}", response_model=InvestimentoOut)
def update_investimento(
    investimento_id: int,
    payload: InvestimentoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_investimento(db, current_user.id, investimento_id, nome=payload.nome)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{investimento_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investimento(
    investimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete_investimento(db, current_user.id, investimento_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{investimento_id}/evolucao", response_model=InvestimentoEvolucaoOut)
def get_evolucao(
    investimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.get_evolucao(db, current_user.id, investimento_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{investimento_id}/evolucao-mensal", response_model=list[EvolucaoMensalOut])
def get_evolucao_mensal(
    investimento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.get_evolucao_mensal(db, current_user.id, investimento_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
