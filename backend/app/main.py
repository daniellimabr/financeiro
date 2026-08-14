from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.assets.router import router as assets_router
from app.auth.router import router as auth_router
from app.categories.router import router as categories_router
from app.categorization.router import router as categorization_router
from app.config import settings
from app.dashboards.router import router as dashboards_router
from app.liabilities.router import router as liabilities_router
from app.pluggy_integration.router import router as pluggy_router

app = FastAPI(title="Financeiro API")
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret_key)
app.include_router(auth_router)
app.include_router(categories_router)
app.include_router(assets_router)
app.include_router(liabilities_router)
app.include_router(pluggy_router)
app.include_router(categorization_router)
app.include_router(dashboards_router)


@app.get("/health")
def health():
    return {"status": "ok"}
