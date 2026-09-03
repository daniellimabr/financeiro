"""Popula (ou repopula, se já existir) a conta demo direto via CLI — mesmo
get-or-create/gerador usados por `GET /demo/enter`. Útil via SSH antes da UI
existir ou como fallback se o botão "Resetar dados demo" falhar.

Uso: python scripts/seed_demo_account.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import SessionLocal  # noqa: E402
from app.demo.service import get_or_create_demo_user  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        user = get_or_create_demo_user(db)
        print(f"Conta demo pronta: id={user.id} email={user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
