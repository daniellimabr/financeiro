from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.categorization import service
from app.db import get_db
from app.exceptions import NotFoundError
from app.models.user import User
from app.schemas.categorization import (
    AssetAssociationIn,
    CategorizationConfirmIn,
    PendingTransactionOut,
)

router = APIRouter(prefix="/categorization")


@router.get("/pending", response_model=list[PendingTransactionOut])
def list_pending(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_pending_transactions(db, current_user.id)


@router.post("/pending/{transaction_id}/confirm", response_model=PendingTransactionOut)
def confirm_categorization(
    transaction_id: int,
    payload: CategorizationConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.confirm_categorization(
            db, current_user.id, transaction_id, payload.subcategory_id
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/pending/{transaction_id}/asset", response_model=PendingTransactionOut)
def set_transaction_asset(
    transaction_id: int,
    payload: AssetAssociationIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.set_transaction_asset(db, current_user.id, transaction_id, payload.asset_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
