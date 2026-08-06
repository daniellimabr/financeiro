from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.category import Natureza


class CategoryGroupIn(BaseModel):
    nome: str = Field(min_length=1, max_length=255)


class CategoryGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    created_at: datetime
    updated_at: datetime


class SubcategoryIn(BaseModel):
    group_id: int
    nome: str = Field(min_length=1, max_length=255)
    natureza: Natureza | None = None


class SubcategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    nome: str
    natureza: Natureza | None
    created_at: datetime
    updated_at: datetime
