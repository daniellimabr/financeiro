from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db import get_db
from app.exceptions import InvalidStateError, NotFoundError
from app.models.pluggy import PluggyTransactionTipo
from app.models.user import User
from app.planejamento import service
from app.schemas.planejamento import (
    GradeOut,
    ItemPlanejadoIn,
    ItemPlanejadoOut,
    PlanejamentoValorEventualIn,
    PlanejamentoValorEventualOut,
    PlanejamentoValorIn,
    PlanejamentoValorOut,
    VincularItemPlanejadoIn,
)

router = APIRouter(prefix="/planejamento")


@router.get("/grade", response_model=GradeOut)
def get_grade(
    ano_base: int,
    mes_base: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_grade(db, current_user.id, ano_base=ano_base, mes_base=mes_base)


@router.put("/valores/{subcategory_id}", response_model=PlanejamentoValorOut)
def confirmar_valor(
    subcategory_id: int,
    payload: PlanejamentoValorIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.confirmar_valor(
            db,
            current_user.id,
            subcategory_id,
            ano=payload.ano,
            mes=payload.mes,
            valor=payload.valor,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/valores/{subcategory_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_valor(
    subcategory_id: int,
    ano: int,
    mes: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.remover_valor(db, current_user.id, subcategory_id, ano=ano, mes=mes)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/valores-eventual/{tipo}", response_model=PlanejamentoValorEventualOut)
def confirmar_valor_eventual(
    tipo: PluggyTransactionTipo,
    payload: PlanejamentoValorEventualIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.confirmar_valor_eventual(
        db,
        current_user.id,
        tipo,
        ano=payload.ano,
        mes=payload.mes,
        valor=payload.valor,
    )


@router.delete("/valores-eventual/{tipo}", status_code=status.HTTP_204_NO_CONTENT)
def remover_valor_eventual(
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.remover_valor_eventual(db, current_user.id, tipo, ano=ano, mes=mes)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/itens", response_model=list[ItemPlanejadoOut])
def list_itens(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return service.list_itens_planejados(db, current_user.id)


@router.post("/itens", response_model=ItemPlanejadoOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemPlanejadoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create_item_planejado(
        db,
        current_user.id,
        nome=payload.nome,
        tipo=payload.tipo,
        valor=payload.valor,
        data_inicio=payload.data_inicio,
        recorrente=payload.recorrente,
        data_fim=payload.data_fim,
    )


@router.put("/itens/{item_id}", response_model=ItemPlanejadoOut)
def update_item(
    item_id: int,
    payload: ItemPlanejadoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_item_planejado(
            db,
            current_user.id,
            item_id,
            nome=payload.nome,
            tipo=payload.tipo,
            valor=payload.valor,
            data_inicio=payload.data_inicio,
            recorrente=payload.recorrente,
            data_fim=payload.data_fim,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/itens/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete_item_planejado(db, current_user.id, item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/itens/{item_id}/vincular", response_model=ItemPlanejadoOut)
def vincular_item(
    item_id: int,
    payload: VincularItemPlanejadoIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.vincular_item_planejado(
            db, current_user.id, item_id, transacao_id=payload.transacao_id
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/itens/{item_id}/desvincular", response_model=ItemPlanejadoOut)
def desvincular_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.desvincular_item_planejado(db, current_user.id, item_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
