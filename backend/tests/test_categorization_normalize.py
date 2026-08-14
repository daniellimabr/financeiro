import pytest

from app.categorization.normalize import normalize_description


def test_normalize_empty_string_returns_empty():
    assert normalize_description("") == ""


def test_normalize_removes_accents_and_lowercases():
    assert normalize_description("Ajuste a Crédito") == "ajuste a credito"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Compra com cartão de débito Padaria X", "padaria x"),
        ("Compra com cartão de crédito Amazon BR", "amazon br"),
        ("PIX recebido João da Silva", "joao da silva"),
        ("PIX enviado Maria Souza", "maria souza"),
        ("Débito automático Vivo Fibra", "vivo fibra"),
        ("Pagamento de boleto Enel", "enel"),
        ("Pagamento de fatura Nubank", "nubank"),
    ],
)
def test_normalize_strips_channel_prefix(raw, expected):
    assert normalize_description(raw) == expected


def test_normalize_removes_isolated_numeric_tokens_but_keeps_alphanumeric():
    assert normalize_description("PAG 12345 IFOOD1") == "pag ifood1"


def test_normalize_removes_punctuation_and_collapses_spaces():
    assert normalize_description("PAG*IFOOD*  BR") == "pag ifood br"
