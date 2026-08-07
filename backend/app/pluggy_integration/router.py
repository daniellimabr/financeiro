from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.exceptions import InvalidStateError, NotFoundError
from app.models.user import User
from app.pluggy_integration import service
from app.pluggy_integration.client import PluggyClient
from app.schemas.pluggy import (
    ConnectTokenIn,
    ConnectTokenOut,
    PluggyAccountOut,
    PluggyItemIn,
    PluggyItemOut,
    PluggyTransactionOut,
)

router = APIRouter(prefix="/pluggy")

_client: PluggyClient | None = None


def get_pluggy_client() -> PluggyClient:
    global _client
    if _client is None:
        _client = PluggyClient(
            client_id=settings.pluggy_client_id,
            client_secret=settings.pluggy_client_secret,
            base_url=settings.pluggy_base_url,
        )
    return _client


@router.post("/connect-token", response_model=ConnectTokenOut)
def create_connect_token(
    payload: ConnectTokenIn = ConnectTokenIn(),
    client: PluggyClient = Depends(get_pluggy_client),
    current_user: User = Depends(get_current_user),
):
    token = service.create_connect_token(client, item_id=payload.item_id)
    return ConnectTokenOut(access_token=token)


@router.get("/items", response_model=list[PluggyItemOut])
def list_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_items(db, current_user.id)


@router.post("/items", response_model=PluggyItemOut, status_code=status.HTTP_201_CREATED)
def register_item(
    payload: PluggyItemIn,
    db: Session = Depends(get_db),
    client: PluggyClient = Depends(get_pluggy_client),
    current_user: User = Depends(get_current_user),
):
    return service.register_item(db, client, current_user.id, payload.pluggy_item_id)


@router.post("/items/{item_id}/sync", response_model=PluggyItemOut)
def sync_item(
    item_id: int,
    db: Session = Depends(get_db),
    client: PluggyClient = Depends(get_pluggy_client),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.sync_item(db, client, current_user.id, item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/accounts", response_model=list[PluggyAccountOut])
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_accounts(db, current_user.id)


@router.get("/transactions", response_model=list[PluggyTransactionOut])
def list_transactions(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return service.list_transactions(db, current_user.id)
