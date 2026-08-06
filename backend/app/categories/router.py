from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.categories import service
from app.db import get_db
from app.exceptions import DuplicateNameError, NotFoundError
from app.schemas.category import CategoryGroupIn, CategoryGroupOut, SubcategoryIn, SubcategoryOut

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/category-groups", response_model=list[CategoryGroupOut])
def list_category_groups(db: Session = Depends(get_db)):
    return service.list_groups(db)


@router.post(
    "/category-groups", response_model=CategoryGroupOut, status_code=status.HTTP_201_CREATED
)
def create_category_group(payload: CategoryGroupIn, db: Session = Depends(get_db)):
    try:
        return service.create_group(db, nome=payload.nome)
    except DuplicateNameError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/category-groups/{group_id}", response_model=CategoryGroupOut)
def get_category_group(group_id: int, db: Session = Depends(get_db)):
    try:
        return service.get_group(db, group_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/category-groups/{group_id}", response_model=CategoryGroupOut)
def update_category_group(group_id: int, payload: CategoryGroupIn, db: Session = Depends(get_db)):
    try:
        return service.update_group(db, group_id, nome=payload.nome)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateNameError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/category-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category_group(group_id: int, db: Session = Depends(get_db)):
    try:
        service.delete_group(db, group_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/subcategories", response_model=list[SubcategoryOut])
def list_subcategories(group_id: int | None = None, db: Session = Depends(get_db)):
    return service.list_subcategories(db, group_id=group_id)


@router.post("/subcategories", response_model=SubcategoryOut, status_code=status.HTTP_201_CREATED)
def create_subcategory(payload: SubcategoryIn, db: Session = Depends(get_db)):
    try:
        return service.create_subcategory(
            db, group_id=payload.group_id, nome=payload.nome, natureza=payload.natureza
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateNameError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/subcategories/{subcategory_id}", response_model=SubcategoryOut)
def get_subcategory(subcategory_id: int, db: Session = Depends(get_db)):
    try:
        return service.get_subcategory(db, subcategory_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/subcategories/{subcategory_id}", response_model=SubcategoryOut)
def update_subcategory(subcategory_id: int, payload: SubcategoryIn, db: Session = Depends(get_db)):
    try:
        return service.update_subcategory(
            db,
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
def delete_subcategory(subcategory_id: int, db: Session = Depends(get_db)):
    try:
        service.delete_subcategory(db, subcategory_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
