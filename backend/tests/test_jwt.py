from datetime import UTC, datetime, timedelta

import jwt as pyjwt
import pytest

from app.auth.jwt import create_access_token, decode_access_token
from app.config import settings


def test_create_and_decode_valid_token():
    token = create_access_token(user_id=42)
    assert decode_access_token(token) == 42


def test_decode_expired_token_raises():
    expired_payload = {
        "sub": "42",
        "iat": datetime.now(UTC) - timedelta(days=8),
        "exp": datetime.now(UTC) - timedelta(days=1),
    }
    token = pyjwt.encode(expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    with pytest.raises(pyjwt.ExpiredSignatureError):
        decode_access_token(token)


def test_decode_token_with_invalid_signature_raises():
    token = create_access_token(user_id=42)
    # Corrompe vários caracteres da assinatura, não só o último: mudar um único
    # caractere final do base64url às vezes decodifica para os mesmos bytes
    # (o último grupo de 6 bits pode ter bits de padding não significativos),
    # o que tornava esse teste esporadicamente flaky (visto na CI da Sprint 2).
    tampered = token[:-8] + ("x" * 8 if token[-8:] != "x" * 8 else "y" * 8)

    with pytest.raises(pyjwt.PyJWTError):
        decode_access_token(tampered)
