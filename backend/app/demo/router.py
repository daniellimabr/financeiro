from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.jwt import COOKIE_NAME, create_access_token
from app.config import settings
from app.db import get_db
from app.demo.service import get_or_create_demo_user, reset_demo_data
from app.models.user import User

router = APIRouter(prefix="/demo", tags=["demo"])


def _require_demo_allowed(current_user: User) -> None:
    # Checagem a partir da sessão real já autenticada (get_current_user),
    # nunca de um parâmetro de request — só quem já está logado como o e-mail
    # permitido pode acionar a troca para o usuário demo.
    if current_user.email != settings.demo_allowed_email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")


@router.get("/enter")
def enter_demo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_demo_allowed(current_user)

    demo_user = get_or_create_demo_user(db)

    jwt_token = create_access_token(demo_user.id)
    response = RedirectResponse(url=settings.frontend_login_success_path)
    response.set_cookie(
        key=COOKIE_NAME,
        value=jwt_token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.jwt_expire_minutes * 60,
    )
    return response


@router.post("/reset", status_code=status.HTTP_204_NO_CONTENT)
def reset_demo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_demo_allowed(current_user)
    reset_demo_data(db)
