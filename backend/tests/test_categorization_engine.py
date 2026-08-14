from datetime import date
from decimal import Decimal

from app.categorization import engine
from app.models.asset import Asset, AssetTipo
from app.models.categorization import CategorizationRule
from app.models.category import CategoryGroup, Subcategory
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User

_SEQ = iter(range(1, 10_000))


def _user(db_session, **overrides):
    n = next(_SEQ)
    defaults = {"google_sub": f"google-{n}", "email": f"user{n}@example.com", "name": "Alice"}
    defaults.update(overrides)
    user = User(**defaults)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _subcategory(db_session, nome="Comer fora", grupo=None):
    group = CategoryGroup(nome=grupo or f"Grupo {next(_SEQ)}")
    db_session.add(group)
    db_session.flush()
    subcategory = Subcategory(group_id=group.id, nome=nome)
    db_session.add(subcategory)
    db_session.commit()
    db_session.refresh(subcategory)
    return subcategory


def _confirmed_transaction(db_session, user, subcategory, descricao):
    n = next(_SEQ)
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"item-{n}",
        connector_id=1,
        connector_name="Banco Fake",
        status=PluggyItemStatus.updated,
        cutoff_date=date(2026, 1, 1),
    )
    db_session.add(item)
    db_session.flush()
    account = PluggyAccount(
        item_id=item.id,
        user_id=user.id,
        pluggy_account_id=f"acc-{n}",
        tipo=PluggyAccountTipo.corrente,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{n}",
        descricao=descricao,
        valor=Decimal("-10.00"),
        tipo=PluggyTransactionTipo.debito,
        data=date(2026, 1, 15),
        status=PluggyTransactionStatus.efetivada,
        categorizacao_status=PluggyTransactionCategorizacaoStatus.confirmada,
        subcategory_id=subcategory.id,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def test_suggest_category_returns_none_when_nothing_matches(db_session):
    user = _user(db_session)

    assert engine.suggest_category(db_session, user.id, "Loja desconhecida") is None


def test_suggest_category_regra_wins_over_historico_exato_and_similar(db_session):
    user = _user(db_session)
    subcategory_regra = _subcategory(db_session, nome="Comer fora")
    subcategory_historico = _subcategory(db_session, nome="Supermercado")

    db_session.add(
        CategorizationRule(
            user_id=user.id,
            subcategory_id=subcategory_regra.id,
            padrao_descricao="Mercado Sao Joao",
            padrao_normalizado="mercado sao joao",
            origem="legado",
        )
    )
    db_session.commit()
    # Confirmed history with the exact same normalized description, different category —
    # if precedence were wrong, this would win instead of the rule.
    _confirmed_transaction(db_session, user, subcategory_historico, "Mercado Sao Joao")

    suggestion = engine.suggest_category(db_session, user.id, "Mercado Sao Joao")

    assert suggestion is not None
    assert suggestion.fonte_tipo == "regra"
    assert suggestion.subcategory_id == subcategory_regra.id


def test_suggest_category_historico_exato_wins_over_similar(db_session):
    user = _user(db_session)
    subcategory_exato = _subcategory(db_session, nome="Comer fora")
    subcategory_similar = _subcategory(db_session, nome="Supermercado")

    _confirmed_transaction(db_session, user, subcategory_exato, "Padaria Bom Pao")
    # Highly similar (but not identical) description, would score high on layer 2.
    _confirmed_transaction(db_session, user, subcategory_similar, "Padaria Bom Pai")

    suggestion = engine.suggest_category(db_session, user.id, "Padaria Bom Pao")

    assert suggestion.fonte_tipo == "historico_exato"
    assert suggestion.subcategory_id == subcategory_exato.id


def test_suggest_category_similarity_at_or_above_threshold_matches(db_session):
    user = _user(db_session)
    subcategory = _subcategory(db_session)
    base = "mercado sao joao ltda"
    _confirmed_transaction(db_session, user, subcategory, base)

    # ratio(base, base + "x"*6) == 0.875 >= 0.86
    suggestion = engine.suggest_category(db_session, user.id, base + "xxxxxx")

    assert suggestion is not None
    assert suggestion.fonte_tipo == "historico_similar"
    assert suggestion.subcategory_id == subcategory.id
    assert suggestion.score == 0.875


def test_suggest_category_below_similarity_threshold_returns_none(db_session):
    user = _user(db_session)
    subcategory = _subcategory(db_session)
    base = "mercado sao joao ltda"
    _confirmed_transaction(db_session, user, subcategory, base)

    # ratio(base, base + "x"*7) == 0.857... < 0.86
    suggestion = engine.suggest_category(db_session, user.id, base + "xxxxxxx")

    assert suggestion is None


def test_suggest_category_isolated_by_user(db_session):
    user = _user(db_session)
    other_user = _user(db_session)
    subcategory = _subcategory(db_session)
    _confirmed_transaction(db_session, other_user, subcategory, "Mercado Sao Joao")

    assert engine.suggest_category(db_session, user.id, "Mercado Sao Joao") is None


def test_suggest_asset_matches_by_normalized_contains(db_session):
    user = _user(db_session)
    asset = Asset(
        user_id=user.id,
        nome="Apartamento Centro",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("500000.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    suggestion = engine.suggest_asset(db_session, user.id, "Condominio Apartamento Centro Mes 08")

    assert suggestion is not None
    assert suggestion.asset_id == asset.id
    assert suggestion.confianca == "media"


def test_suggest_asset_isolated_by_user(db_session):
    user = _user(db_session)
    other_user = _user(db_session)
    asset = Asset(
        user_id=other_user.id,
        nome="Apartamento Centro",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("500000.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()

    assert engine.suggest_asset(db_session, user.id, "Apartamento Centro") is None


def test_suggest_asset_returns_none_when_no_match(db_session):
    user = _user(db_session)
    asset = Asset(
        user_id=user.id,
        nome="Apartamento Centro",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("500000.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()

    assert engine.suggest_asset(db_session, user.id, "Supermercado Extra") is None
