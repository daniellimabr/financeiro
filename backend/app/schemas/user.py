from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    salario_competencia_cutoff_dia: int
    created_at: datetime


class UserSettingsIn(BaseModel):
    cutoff_dia: int = Field(ge=1, le=28)
