from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.categorization import service
from app.db import get_db
from app.exceptions import InvalidStateError, NotFoundError
from app.models.pluggy import PluggyTransactionTipo
from app.models.user import User
from app.schemas.categorization import (
    AssetAssociationIn,
    BulkConfirmIn,
    BulkConfirmOut,
    BulkConfirmResultOut,
    CategoryIn,
    DescriptionUpdateIn,
    DescriptionUpdateOut,
    LiabilityAssociationIn,
    TransactionOut,
    TransactionsPageOut,
)

router = APIRouter(prefix="/categorization")


@router.get("/transactions", response_model=TransactionsPageOut)
def list_transactions(
    status_filtro: str = Query("todas", alias="status", pattern="^(pendente|confirmada|todas)$"),
    tipo: PluggyTransactionTipo | None = None,
    ano: int | None = None,
    mes: int | None = None,
    has_asset: bool | None = None,
    group_id: int | None = None,
    account_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = service.list_transactions(
        db,
        current_user.id,
        status=status_filtro,
        tipo=tipo,
        ano=ano,
        mes=mes,
        has_asset=has_asset,
        group_id=group_id,
        account_id=account_id,
        page=page,
        page_size=page_size,
    )
    return TransactionsPageOut(items=items, total=total, page=page, page_size=page_size)


@router.put("/transactions/{transaction_id}/category", response_model=TransactionOut)
def set_category(
    transaction_id: int,
    payload: CategoryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.set_category(db, current_user.id, transaction_id, payload.subcategory_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/transactions/bulk-confirm", response_model=BulkConfirmOut)
def bulk_confirm(
    payload: BulkConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = [(item.transaction_id, item.subcategory_id) for item in payload.items]
    results = service.bulk_confirm(db, current_user.id, items)
    return BulkConfirmOut(
        results=[
            BulkConfirmResultOut(transaction_id=r.transaction_id, success=r.success, error=r.error)
            for r in results
        ]
    )


@router.put("/transactions/{transaction_id}/asset", response_model=TransactionOut)
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


@router.put("/transactions/{transaction_id}/liability", response_model=TransactionOut)
def set_transaction_liability(
    transaction_id: int,
    payload: LiabilityAssociationIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.set_transaction_liability(
            db, current_user.id, transaction_id, payload.liability_id
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/transactions/{transaction_id}/description", response_model=DescriptionUpdateOut)
def update_description(
    transaction_id: int,
    payload: DescriptionUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        tx, propagated = service.update_description(
            db, current_user.id, transaction_id, payload.descricao
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return DescriptionUpdateOut(transaction=tx, propagated=propagated)


@router.post("/transactions/{transaction_id}/description/confirm", response_model=TransactionOut)
def confirm_description_suggestion(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.confirm_description_suggestion(db, current_user.id, transaction_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/transactions/{transaction_id}/description/dismiss", response_model=TransactionOut)
def dismiss_description_suggestion(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.dismiss_description_suggestion(db, current_user.id, transaction_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
