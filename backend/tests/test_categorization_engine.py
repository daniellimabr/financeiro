from datetime import date
from decimal import Decimal

from app.categorization import engine
from app.models.asset import Asset, AssetTipo
from app.models.categorization import (
    AssetCategorizationRule,
    CategorizationRule,
    InvestimentoCategorizationRule,
)
from app.models.category import CategoryGroup, Subcategory
from app.models.investimento import Investimento
from app.models.liability import Liability, LiabilityTipo
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


def _asset(db_session, user, nome="Apartamento Centro"):
    asset = Asset(
        user_id=user.id,
        nome=nome,
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("500000.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    return asset


def _confirmed_asset_transaction(db_session, user, asset, descricao):
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
        asset_id=asset.id,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def test_suggest_asset_returns_none_when_nothing_matches(db_session):
    user = _user(db_session)

    assert engine.suggest_asset(db_session, user.id, "Loja desconhecida") is None


def test_suggest_asset_regra_wins_over_historico_exato_and_similar(db_session):
    user = _user(db_session)
    asset_regra = _asset(db_session, user, nome="Apartamento Centro")
    asset_historico = _asset(db_session, user, nome="Casa Praia")

    db_session.add(
        AssetCategorizationRule(
            user_id=user.id,
            asset_id=asset_regra.id,
            padrao_descricao="Condominio Predio X",
            padrao_normalizado="condominio predio x",
            origem="usuario_confirmou",
        )
    )
    db_session.commit()
    # Confirmed history with the exact same normalized description, different
    # asset — if precedence were wrong, this would win instead of the rule.
    _confirmed_asset_transaction(db_session, user, asset_historico, "Condominio Predio X")

    suggestion = engine.suggest_asset(db_session, user.id, "Condominio Predio X")

    assert suggestion is not None
    assert suggestion.confianca == "alta"
    assert suggestion.asset_id == asset_regra.id


def test_suggest_asset_historico_exato_wins_over_similar(db_session):
    user = _user(db_session)
    asset_exato = _asset(db_session, user, nome="Apartamento Centro")
    asset_similar = _asset(db_session, user, nome="Casa Praia")

    _confirmed_asset_transaction(db_session, user, asset_exato, "IPTU Apartamento Centro")
    # Highly similar (but not identical) description, would score high on layer 3.
    _confirmed_asset_transaction(db_session, user, asset_similar, "IPTU Apartamento Centri")

    suggestion = engine.suggest_asset(db_session, user.id, "IPTU Apartamento Centro")

    assert suggestion.confianca == "alta"
    assert suggestion.asset_id == asset_exato.id


def test_suggest_asset_similarity_at_or_above_threshold_matches(db_session):
    user = _user(db_session)
    asset = _asset(db_session, user)
    base = "condominio predio central ltda"
    _confirmed_asset_transaction(db_session, user, asset, base)

    # ratio(base, base + "x"*6) == 0.885... >= 0.86
    suggestion = engine.suggest_asset(db_session, user.id, base + "xxxxxx")

    assert suggestion is not None
    assert suggestion.confianca == "alta"
    assert suggestion.asset_id == asset.id


def test_suggest_asset_below_similarity_threshold_returns_none(db_session):
    user = _user(db_session)
    asset = _asset(db_session, user)
    base = "condominio predio central ltda"
    _confirmed_asset_transaction(db_session, user, asset, base)

    suggestion = engine.suggest_asset(db_session, user.id, base + "xxxxxxxxxxxx")

    assert suggestion is None


def test_suggest_asset_isolated_by_user(db_session):
    user = _user(db_session)
    other_user = _user(db_session)
    asset = _asset(db_session, other_user, nome="Apartamento Centro")
    _confirmed_asset_transaction(db_session, other_user, asset, "Apartamento Centro")

    assert engine.suggest_asset(db_session, user.id, "Apartamento Centro") is None


def test_suggest_asset_returns_none_when_no_match(db_session):
    user = _user(db_session)
    asset = _asset(db_session, user, nome="Apartamento Centro")
    _confirmed_asset_transaction(db_session, user, asset, "Apartamento Centro")

    assert engine.suggest_asset(db_session, user.id, "Supermercado Extra") is None


def _investimento(db_session, user, nome="Reserva de emergência"):
    investimento = Investimento(user_id=user.id, nome=nome)
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)
    return investimento


def _confirmed_investimento_transaction(db_session, user, investimento, descricao):
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
        investimento_id=investimento.id,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def test_suggest_investimento_returns_none_when_nothing_matches(db_session):
    user = _user(db_session)

    assert engine.suggest_investimento(db_session, user.id, "Loja desconhecida") is None


def test_suggest_investimento_regra_wins_over_historico_exato(db_session):
    user = _user(db_session)
    investimento_regra = _investimento(db_session, user, nome="Reserva")
    investimento_historico = _investimento(db_session, user, nome="Renda fixa XP")

    db_session.add(
        InvestimentoCategorizationRule(
            user_id=user.id,
            investimento_id=investimento_regra.id,
            padrao_descricao="Aporte Nubank Investimentos",
            padrao_normalizado="aporte nubank investimentos",
            origem="usuario_confirmou",
        )
    )
    db_session.commit()
    _confirmed_investimento_transaction(
        db_session, user, investimento_historico, "Aporte Nubank Investimentos"
    )

    suggestion = engine.suggest_investimento(db_session, user.id, "Aporte Nubank Investimentos")

    assert suggestion is not None
    assert suggestion.confianca == "alta"
    assert suggestion.investimento_id == investimento_regra.id


def test_suggest_investimento_historico_exato_wins_over_similar(db_session):
    user = _user(db_session)
    investimento_exato = _investimento(db_session, user, nome="Reserva")
    investimento_similar = _investimento(db_session, user, nome="Renda fixa")

    _confirmed_investimento_transaction(db_session, user, investimento_exato, "Resgate Nubank Inv")
    _confirmed_investimento_transaction(
        db_session, user, investimento_similar, "Resgate Nubank Inw"
    )

    suggestion = engine.suggest_investimento(db_session, user.id, "Resgate Nubank Inv")

    assert suggestion.confianca == "alta"
    assert suggestion.investimento_id == investimento_exato.id


def test_suggest_investimento_similarity_at_or_above_threshold_matches(db_session):
    user = _user(db_session)
    investimento = _investimento(db_session, user)
    base = "aporte nubank investimentos ltda"
    _confirmed_investimento_transaction(db_session, user, investimento, base)

    # ratio(base, base + "x"*6) >= 0.86
    suggestion = engine.suggest_investimento(db_session, user.id, base + "xxxxxx")

    assert suggestion is not None
    assert suggestion.investimento_id == investimento.id


def test_suggest_investimento_below_similarity_threshold_returns_none(db_session):
    user = _user(db_session)
    investimento = _investimento(db_session, user)
    base = "aporte nubank investimentos ltda"
    _confirmed_investimento_transaction(db_session, user, investimento, base)

    suggestion = engine.suggest_investimento(db_session, user.id, base + "xxxxxxxxxxxx")

    assert suggestion is None


def test_suggest_investimento_isolated_by_user(db_session):
    user = _user(db_session)
    other_user = _user(db_session)
    investimento = _investimento(db_session, other_user, nome="Reserva")
    _confirmed_investimento_transaction(db_session, other_user, investimento, "Aporte Nubank")

    assert engine.suggest_investimento(db_session, user.id, "Aporte Nubank") is None


def test_suggest_liability_matches_by_normalized_contains(db_session):
    user = _user(db_session)
    liability = Liability(
        user_id=user.id,
        nome="Financiamento Carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()
    db_session.refresh(liability)

    suggestion = engine.suggest_liability(db_session, user.id, "Parcela Financiamento Carro Mes 08")

    assert suggestion is not None
    assert suggestion.liability_id == liability.id
    assert suggestion.confianca == "media"


def test_suggest_liability_isolated_by_user(db_session):
    user = _user(db_session)
    other_user = _user(db_session)
    liability = Liability(
        user_id=other_user.id,
        nome="Financiamento Carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()

    assert engine.suggest_liability(db_session, user.id, "Financiamento Carro") is None


def test_suggest_liability_returns_none_when_no_match(db_session):
    user = _user(db_session)
    liability = Liability(
        user_id=user.id,
        nome="Financiamento Carro",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()

    assert engine.suggest_liability(db_session, user.id, "Supermercado Extra") is None
