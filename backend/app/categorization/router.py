from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    PendingTransactionsPageOut,
)

router = APIRouter(prefix="/categorization")


@router.get("/pending", response_model=PendingTransactionsPageOut)
def list_pending(
    ano: int | None = None,
    mes: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = service.list_pending_transactions(
        db, current_user.id, ano=ano, mes=mes, page=page, page_size=page_size
    )
    return PendingTransactionsPageOut(items=items, total=total, page=page, page_size=page_size)


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
