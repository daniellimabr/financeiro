"""Validação manual das credenciais Pluggy (sandbox) — não roda em CI.

Testa autenticação (API key), geração de connect token e, se um
`pluggy_item_id` já conectado for informado, busca contas e transações
reais para conferir o round-trip completo.

Uso: python scripts/pluggy_sandbox_smoke.py [pluggy_item_id]
Requer PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET configurados no .env.
"""

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.pluggy_integration.client import PluggyClient  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("pluggy_sandbox_smoke")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validação manual do sandbox Pluggy")
    parser.add_argument(
        "item_id", nargs="?", help="pluggy_item_id já conectado, para testar contas/transações"
    )
    args = parser.parse_args()

    if not settings.pluggy_client_id or not settings.pluggy_client_secret:
        logger.error("PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não configurados no .env")
        sys.exit(1)

    client = PluggyClient(
        client_id=settings.pluggy_client_id,
        client_secret=settings.pluggy_client_secret,
        base_url=settings.pluggy_base_url,
    )

    logger.info("Autenticando na API Pluggy (%s)...", settings.pluggy_base_url)
    token = client.create_connect_token()
    logger.info("Connect token obtido com sucesso (%s...)", token[:12])

    if not args.item_id:
        logger.info("Nenhum item_id informado — validados apenas auth + connect-token.")
        return

    logger.info("Buscando item %s...", args.item_id)
    item = client.get_item(args.item_id)
    logger.info("Item status: %s", item.get("status"))

    accounts = client.get_accounts(args.item_id)
    logger.info("%s conta(s) encontrada(s)", len(accounts))
    for account in accounts:
        transactions = client.get_transactions(
            account["id"], from_date=settings.pluggy_sync_cutoff_date
        )
        logger.info(
            "Conta %s: %s transação(ões) desde %s",
            account.get("name"),
            len(transactions),
            settings.pluggy_sync_cutoff_date,
        )


if __name__ == "__main__":
    main()
