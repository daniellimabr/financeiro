from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.exceptions import InvalidStateError, NotFoundError
from app.models.pluggy import PluggyAccountTipo, PluggyTransactionTipo
from app.models.user import User
from app.pluggy_integration import service
from app.pluggy_integration.client import PluggyClient
from app.schemas.pluggy import (
    BaselineConfirmIn,
    BaselineProposalLineOut,
    ConnectTokenIn,
    ConnectTokenOut,
    PluggyAccountOut,
    PluggyAccountSaldoInicialIn,
    PluggyAccountUpdateIn,
    PluggyInvestmentOut,
    PluggyInvestmentSaldoInicialIn,
    PluggyInvestmentTransactionOut,
    PluggyInvestmentUpdateIn,
    PluggyItemIn,
    PluggyItemOut,
    PluggyTransactionOut,
    SalarioAjusteDezembroIn,
    SalarioAjusteDezembroOut,
    SyncItemResultOut,
    SyncItemsIn,
    SyncItemsOut,
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


@router.put("/accounts/{account_id}", response_model=PluggyAccountOut)
def update_account(
    account_id: int,
    payload: PluggyAccountUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_account(
            db,
            current_user.id,
            account_id,
            apelido=payload.apelido,
            sync_enabled=payload.sync_enabled,
            investimento_id=payload.investimento_id,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete_account(db, current_user.id, account_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/accounts/{account_id}/saldo-inicial", response_model=PluggyAccountOut)
def update_saldo_inicial(
    account_id: int,
    payload: PluggyAccountSaldoInicialIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_saldo_inicial(
            db, current_user.id, account_id, saldo_inicial=payload.saldo_inicial
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/investments", response_model=list[PluggyInvestmentOut])
def list_investments(
    investimento_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_investments(db, current_user.id, investimento_id=investimento_id)


@router.put("/investments/{investment_id}", response_model=PluggyInvestmentOut)
def update_investment(
    investment_id: int,
    payload: PluggyInvestmentUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_investment(
            db, current_user.id, investment_id, investimento_id=payload.investimento_id
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/investments/{investment_id}/saldo-inicial", response_model=PluggyInvestmentOut)
def update_investment_saldo_inicial(
    investment_id: int,
    payload: PluggyInvestmentSaldoInicialIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_investment_saldo_inicial(
            db, current_user.id, investment_id, saldo_inicial=payload.saldo_inicial
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/investments/{investment_id}/transactions", response_model=list[PluggyInvestmentTransactionOut]
)
def list_investment_transactions(
    investment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.list_investment_transactions(db, current_user.id, investment_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/investments/baseline-dez-2025", response_model=list[BaselineProposalLineOut])
def get_baseline_proposal(
    db: Session = Depends(get_db),
    client: PluggyClient = Depends(get_pluggy_client),
    current_user: User = Depends(get_current_user),
):
    return service.propose_baseline_dez_2025(db, client, current_user.id)


@router.post("/investments/baseline-dez-2025", response_model=list[PluggyInvestmentOut])
def confirm_baseline_proposal(
    payload: BaselineConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        linhas = [(linha.investment_id, linha.saldo_inicial) for linha in payload.linhas]
        investments = service.confirm_baseline_dez_2025(db, current_user.id, linhas)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    service.reconstruct_historical_snapshots(db, current_user.id)
    return investments


@router.get("/ajuste-salario-dezembro", response_model=SalarioAjusteDezembroOut | None)
def get_ajuste_salario_dezembro(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    tx = service.get_salario_ajuste_dez_2025(db, current_user.id)
    if tx is None:
        return None
    return SalarioAjusteDezembroOut(account_id=tx.account_id, data=tx.data, valor=tx.valor)


@router.put("/ajuste-salario-dezembro", response_model=SalarioAjusteDezembroOut | None)
def update_ajuste_salario_dezembro(
    payload: SalarioAjusteDezembroIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        tx = service.upsert_salario_ajuste_dez_2025(
            db,
            current_user.id,
            account_id=payload.account_id,
            data=payload.data,
            valor=payload.valor,
            cutoff_dia=current_user.salario_competencia_cutoff_dia,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if tx is None:
        return None
    return SalarioAjusteDezembroOut(account_id=tx.account_id, data=tx.data, valor=tx.valor)


@router.post("/sync", response_model=SyncItemsOut)
def sync_items(
    payload: SyncItemsIn = SyncItemsIn(),
    db: Session = Depends(get_db),
    client: PluggyClient = Depends(get_pluggy_client),
    current_user: User = Depends(get_current_user),
):
    results = service.sync_items(db, client, current_user.id, payload.item_ids)
    return SyncItemsOut(
        results=[
            SyncItemResultOut(item_id=r.item_id, success=r.success, error=r.error, item=r.item)
            for r in results
        ]
    )


@router.get("/transactions", response_model=list[PluggyTransactionOut])
def list_transactions(
    ano: int | None = None,
    mes: int | None = None,
    subcategory_id: int | None = None,
    account_tipo: PluggyAccountTipo | None = None,
    asset_id: int | None = None,
    liability_id: int | None = None,
    investimento_id: int | None = None,
    tipo: PluggyTransactionTipo | None = None,
    competencia: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_transactions(
        db,
        current_user.id,
        ano=ano,
        mes=mes,
        subcategory_id=subcategory_id,
        account_tipo=account_tipo,
        asset_id=asset_id,
        liability_id=liability_id,
        investimento_id=investimento_id,
        tipo=tipo,
        competencia=competencia,
    )
