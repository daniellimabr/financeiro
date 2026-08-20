from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.categories import service
from app.db import get_db
from app.exceptions import DuplicateNameError, InvalidStateError, NotFoundError
from app.models.user import User
from app.schemas.category import CategoryGroupIn, CategoryGroupOut, SubcategoryIn, SubcategoryOut

router = APIRouter()


@router.get("/category-groups", response_model=list[CategoryGroupOut])
def list_category_groups(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    return service.list_groups(db, current_user.id)


@router.post(
    "/category-groups", response_model=CategoryGroupOut, status_code=status.HTTP_201_CREATED
)
def create_category_group(
    payload: CategoryGroupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create_group(db, current_user.id, nome=payload.nome)
    except DuplicateNameError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/category-groups/{group_id}", response_model=CategoryGroupOut)
def get_category_group(
    group_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        return service.get_group(db, current_user.id, group_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/category-groups/{group_id}", response_model=CategoryGroupOut)
def update_category_group(
    group_id: int,
    payload: CategoryGroupIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_group(db, current_user.id, group_id, nome=payload.nome)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateNameError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/category-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category_group(
    group_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    try:
        service.delete_group(db, current_user.id, group_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/subcategories", response_model=list[SubcategoryOut])
def list_subcategories(
    group_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_subcategories(db, current_user.id, group_id=group_id)


@router.post("/subcategories", response_model=SubcategoryOut, status_code=status.HTTP_201_CREATED)
def create_subcategory(
    payload: SubcategoryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.create_subcategory(
            db,
            current_user.id,
            group_id=payload.group_id,
            nome=payload.nome,
            natureza=payload.natureza,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateNameError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/subcategories/{subcategory_id}", response_model=SubcategoryOut)
def get_subcategory(
    subcategory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.get_subcategory(db, current_user.id, subcategory_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/subcategories/{subcategory_id}", response_model=SubcategoryOut)
def update_subcategory(
    subcategory_id: int,
    payload: SubcategoryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return service.update_subcategory(
            db,
            current_user.id,
            subcategory_id,
            group_id=payload.group_id,
            nome=payload.nome,
            natureza=payload.natureza,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateNameError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/subcategories/{subcategory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subcategory(
    subcategory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        service.delete_subcategory(db, current_user.id, subcategory_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
