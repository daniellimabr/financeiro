from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.assets import service
from app.auth.deps import get_current_user
from app.db import get_db
from app.exceptions import InvalidStateError, NotFoundError
from app.models.user import User
from app.schemas.asset import AssetIn, AssetOut, AssetSellIn

router = APIRouter(prefix="/assets")


@router.get("", response_model=list[AssetOut])
def list_assets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_assets(db, current_user.id)


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    payload: AssetIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_asset(
        db,
        current_user.id,
        nome=payload.nome,
        tipo=payload.tipo,
        valor_atual=payload.valor_atual,
        data_aquisicao=payload.data_aquisicao,
    )


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        return service.get_asset(db, current_user.id, asset_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: int,
    payload: AssetIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_asset(
            db,
            current_user.id,
            asset_id,
            nome=payload.nome,
            tipo=payload.tipo,
            valor_atual=payload.valor_atual,
            data_aquisicao=payload.data_aquisicao,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        service.delete_asset(db, current_user.id, asset_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{asset_id}/sell", response_model=AssetOut)
def sell_asset(
    asset_id: int,
    payload: AssetSellIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.sell_asset(
            db,
            current_user.id,
            asset_id,
            valor_venda=payload.valor_venda,
            data_venda=payload.data_venda,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
