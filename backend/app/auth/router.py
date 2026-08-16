from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.google import oauth
from app.auth.jwt import COOKIE_NAME, create_access_token
from app.auth.service import update_settings, upsert_user_from_google
from app.config import settings
from app.db import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserSettingsIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/login")
async def google_login(request: Request):
    redirect_uri = f"{settings.oauth_redirect_base_url}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    userinfo = token["userinfo"]

    user = upsert_user_from_google(
        db,
        google_sub=userinfo["sub"],
        email=userinfo["email"],
        name=userinfo.get("name", userinfo["email"]),
    )

    jwt_token = create_access_token(user.id)
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


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, current_user: User = Depends(get_current_user)):
    response.delete_cookie(key=COOKIE_NAME, samesite="lax", secure=settings.cookie_secure)


@router.put("/me/settings", response_model=UserOut)
def update_my_settings(
    payload: UserSettingsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_settings(db, current_user, cutoff_dia=payload.cutoff_dia)
