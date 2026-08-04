from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.auth.router import router as auth_router
from app.config import settings

app = FastAPI(title="Financeiro API")
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret_key)
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "ok"}
