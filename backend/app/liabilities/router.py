from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.exceptions import InvalidStateError, NotFoundError
from app.liabilities import service
from app.models.user import User
from app.schemas.liability import LiabilityIn, LiabilityOut

router = APIRouter(prefix="/liabilities")


@router.get("", response_model=list[LiabilityOut])
def list_liabilities(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_liabilities(db, current_user.id)


@router.post("", response_model=LiabilityOut, status_code=status.HTTP_201_CREATED)
def create_liability(
    payload: LiabilityIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_liability(
        db,
        current_user.id,
        nome=payload.nome,
        tipo=payload.tipo,
        valor_total=payload.valor_total,
        saldo_devedor=payload.saldo_devedor,
    )


@router.get("/{liability_id}", response_model=LiabilityOut)
def get_liability(
    liability_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        return service.get_liability(db, current_user.id, liability_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{liability_id}", response_model=LiabilityOut)
def update_liability(
    liability_id: int,
    payload: LiabilityIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_liability(
            db,
            current_user.id,
            liability_id,
            nome=payload.nome,
            tipo=payload.tipo,
            valor_total=payload.valor_total,
            saldo_devedor=payload.saldo_devedor,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{liability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_liability(
    liability_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        service.delete_liability(db, current_user.id, liability_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{liability_id}/settle", response_model=LiabilityOut)
def settle_liability(
    liability_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        return service.settle_liability(db, current_user.id, liability_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
