import re
import unicodedata

_CHANNEL_PREFIXES = [
    "compra com cartao de debito",
    "compra com cartao de credito",
    "compra cartao de debito",
    "compra cartao de credito",
    "compra debito",
    "compra credito",
    "pagamento de boleto",
    "pagamento de fatura",
    "pagamento efetuado",
    "pix qr code",
    "pix recebido",
    "pix enviado",
    "transferencia recebida",
    "transferencia enviada",
    "transferencia pix",
    "debito automatico",
    "ted recebida",
    "ted enviada",
    "doc recebido",
    "doc enviado",
    "saque",
]

_NUMERIC_TOKEN_RE = re.compile(r"^\d+$")
_PUNCTUATION_RE = re.compile(r"[^\w\s]")


def normalize_description(text: str) -> str:
    """NFKD->ASCII->minúsculas, remove prefixo de canal, pontuação e números isolados."""
    if not text:
        return ""

    ascii_only = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower()

    for prefix in _CHANNEL_PREFIXES:
        if lowered.startswith(prefix):
            lowered = lowered[len(prefix) :]
            break

    without_punctuation = _PUNCTUATION_RE.sub(" ", lowered)
    tokens = [token for token in without_punctuation.split() if not _NUMERIC_TOKEN_RE.match(token)]
    return " ".join(tokens)
