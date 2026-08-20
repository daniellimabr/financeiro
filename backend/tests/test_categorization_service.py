from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import event

from app.categorization import service
from app.exceptions import InvalidStateError, NotFoundError
from app.models.asset import Asset, AssetTipo
from app.models.categorization import CategorizationRule
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


@pytest.fixture()
def user(db_session):
    return _user(db_session)


@pytest.fixture()
def other_user(db_session):
    return _user(db_session)


@pytest.fixture()
def subcategory(db_session, user):
    return _subcategory(db_session, user, nome="Comer fora")


@pytest.fixture()
def other_subcategory(db_session, user):
    return _subcategory(db_session, user, nome="Supermercado")


def _user(db_session, **overrides):
    n = next(_SEQ)
    defaults = {"google_sub": f"google-{n}", "email": f"user{n}@example.com", "name": "Alice"}
    defaults.update(overrides)
    u = User(**defaults)
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _subcategory(db_session, user, nome="Comer fora"):
    group = CategoryGroup(user_id=user.id, nome=f"Grupo {next(_SEQ)}")
    db_session.add(group)
    db_session.flush()
    s = Subcategory(user_id=user.id, group_id=group.id, nome=nome)
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


def _salario_subcategory(db_session, user):
    group = (
        db_session.query(CategoryGroup)
        .filter(CategoryGroup.user_id == user.id, CategoryGroup.nome == "Receitas")
        .one_or_none()
    )
    if group is None:
        group = CategoryGroup(user_id=user.id, nome="Receitas")
        db_session.add(group)
        db_session.flush()
    s = Subcategory(user_id=user.id, group_id=group.id, nome="Salário")
    db_session.add(s)
    db_session.commit()
    db_session.refresh(s)
    return s


def _transaction(
    db_session,
    user,
    descricao="Mercado Sao Joao",
    *,
    tipo=PluggyTransactionTipo.debito,
    status_categorizacao=PluggyTransactionCategorizacaoStatus.pendente,
    subcategory_id=None,
    subcategoria_sugerida_id=None,
    data=date(2026, 1, 15),
    account_tipo=PluggyAccountTipo.corrente,
    categoria_pluggy=None,
):
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
        tipo=account_tipo,
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
        tipo=tipo,
        data=data,
        status=PluggyTransactionStatus.efetivada,
        categorizacao_status=status_categorizacao,
        subcategory_id=subcategory_id,
        subcategoria_sugerida_id=subcategoria_sugerida_id,
        categoria_pluggy=categoria_pluggy,
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


def _pending_transaction(db_session, user, descricao="Mercado Sao Joao"):
    return _transaction(db_session, user, descricao)


def _confirmed_transaction(db_session, user, subcategory, descricao):
    return _transaction(
        db_session,
        user,
        descricao,
        status_categorizacao=PluggyTransactionCategorizacaoStatus.confirmada,
        subcategory_id=subcategory.id,
    )


# --- list_transactions -------------------------------------------------


def test_list_transactions_applies_suggestion_but_never_confirms(db_session, user, subcategory):
    db_session.add(
        CategorizationRule(
            user_id=user.id,
            subcategory_id=subcategory.id,
            padrao_descricao="Mercado Sao Joao",
            padrao_normalizado="mercado sao joao",
            origem="legado",
        )
    )
    db_session.commit()
    tx = _pending_transaction(db_session, user, "Mercado Sao Joao")

    for _ in range(2):
        items, total = service.list_transactions(db_session, user.id, status="pendente")
        assert total == 1
        assert len(items) == 1
        result = items[0]
        assert result.id == tx.id
        assert result.subcategoria_sugerida_id == subcategory.id
        assert result.sugestao_fonte_tipo == "regra"
        assert result.subcategory_id is None
        assert result.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente


def test_list_transactions_excludes_investimento_proventos_categoria_pluggy(db_session, user):
    # Achado real do Bloco 0 da Sprint 22: dividendo/JCP/taxa de investimentos
    # administrados (XP) chega numa conta corrente vinculada à corretora,
    # marcada pela Pluggy com essas categorias — sai da fila de Categorização
    # (o CEO não quer administrar/categorizar isso manualmente).
    _transaction(
        db_session, user, "Dividendo TAEE11", categoria_pluggy="Proceeds interests and dividends"
    )
    _transaction(db_session, user, "Taxa de intermediação", categoria_pluggy="Taxes on investments")

    items, total = service.list_transactions(db_session, user.id)

    assert items == []
    assert total == 0


def test_list_transactions_investment_aporte_still_appears(db_session, user):
    # Aporte/resgate continua na fila normal — categoria "Investments" é
    # distinta das categorias de provento excluídas acima (decisão do CEO,
    # Sprint 19/22: ele controla aporte/resgate pela conta corrente).
    _transaction(db_session, user, "Aplicação RDB", categoria_pluggy="Investments")

    items, total = service.list_transactions(db_session, user.id)

    assert total == 1


def test_list_transactions_excludes_conta_investimento(db_session, user):
    _transaction(db_session, user, "Rendimento CDB", account_tipo=PluggyAccountTipo.investimento)

    items, total = service.list_transactions(db_session, user.id)

    assert items == []
    assert total == 0


def test_list_transactions_isolated_by_user(db_session, user, other_user):
    _pending_transaction(db_session, other_user, "Outra transacao")

    items, total = service.list_transactions(db_session, user.id)
    assert items == []
    assert total == 0


def test_list_transactions_default_status_returns_pending_and_confirmed(
    db_session, user, subcategory
):
    _pending_transaction(db_session, user, "Pendente")
    _confirmed_transaction(db_session, user, subcategory, "Confirmada")

    items, total = service.list_transactions(db_session, user.id)

    assert total == 2


def test_list_transactions_status_pendente_excludes_confirmed(db_session, user, subcategory):
    tx_pendente = _pending_transaction(db_session, user, "Pendente")
    _confirmed_transaction(db_session, user, subcategory, "Confirmada")

    items, total = service.list_transactions(db_session, user.id, status="pendente")

    assert total == 1
    assert [tx.id for tx in items] == [tx_pendente.id]


def test_list_transactions_status_confirmada_excludes_pending(db_session, user, subcategory):
    _pending_transaction(db_session, user, "Pendente")
    tx_confirmada = _confirmed_transaction(db_session, user, subcategory, "Confirmada")

    items, total = service.list_transactions(db_session, user.id, status="confirmada")

    assert total == 1
    assert [tx.id for tx in items] == [tx_confirmada.id]


def test_list_transactions_filters_by_tipo(db_session, user):
    tx_debito = _transaction(db_session, user, "Debito", tipo=PluggyTransactionTipo.debito)
    _transaction(db_session, user, "Credito", tipo=PluggyTransactionTipo.credito)

    items, total = service.list_transactions(db_session, user.id, tipo=PluggyTransactionTipo.debito)

    assert total == 1
    assert [tx.id for tx in items] == [tx_debito.id]


def test_list_transactions_filters_by_ano_mes(db_session, user):
    tx_jan = _pending_transaction(db_session, user, "Compra janeiro")
    tx_jan.data = date(2026, 1, 10)
    tx_fev = _pending_transaction(db_session, user, "Compra fevereiro")
    tx_fev.data = date(2026, 2, 10)
    db_session.commit()

    items, total = service.list_transactions(db_session, user.id, ano=2026, mes=1)

    assert total == 1
    assert [tx.id for tx in items] == [tx_jan.id]
    del tx_fev


def test_list_transactions_paginates(db_session, user):
    for i in range(5):
        _pending_transaction(db_session, user, f"Pendente {i}")

    first_page, total = service.list_transactions(db_session, user.id, page=1, page_size=2)
    second_page, total_again = service.list_transactions(db_session, user.id, page=2, page_size=2)

    assert total == 5
    assert total_again == 5
    assert len(first_page) == 2
    assert len(second_page) == 2
    assert {tx.id for tx in first_page}.isdisjoint({tx.id for tx in second_page})


def test_list_transactions_query_count_does_not_scale_with_pending_count(
    db_session, user, subcategory
):
    for i in range(5):
        _confirmed_transaction(db_session, user, subcategory, f"Historico confirmado {i}")
    for i in range(20):
        _pending_transaction(db_session, user, f"Pendente sem match {i}")

    bind = db_session.get_bind()
    select_count = {"n": 0}

    def _count_selects(_conn, _cursor, statement, *_args, **_kwargs):
        if statement.strip().upper().startswith("SELECT"):
            select_count["n"] += 1

    event.listen(bind, "before_cursor_execute", _count_selects)
    try:
        result, total = service.list_transactions(
            db_session, user.id, status="pendente", page_size=20
        )
    finally:
        event.remove(bind, "before_cursor_execute", _count_selects)

    assert len(result) == 20
    assert total == 20
    assert select_count["n"] < 2 * len(result) + 10


def test_list_transactions_filters_by_has_asset_true(db_session, user):
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    tx_com_asset = _pending_transaction(db_session, user, "Com ativo")
    tx_com_asset.asset_id = asset.id
    _pending_transaction(db_session, user, "Sem ativo")
    db_session.commit()

    items, total = service.list_transactions(db_session, user.id, has_asset=True)

    assert total == 1
    assert [tx.id for tx in items] == [tx_com_asset.id]


def test_list_transactions_filters_by_has_asset_false(db_session, user):
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    tx_com_asset = _pending_transaction(db_session, user, "Com ativo")
    tx_com_asset.asset_id = asset.id
    tx_sem_asset = _pending_transaction(db_session, user, "Sem ativo")
    db_session.commit()

    items, total = service.list_transactions(db_session, user.id, has_asset=False)

    assert total == 1
    assert [tx.id for tx in items] == [tx_sem_asset.id]


def test_list_transactions_has_asset_none_does_not_filter(db_session, user):
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    tx_com_asset = _pending_transaction(db_session, user, "Com ativo")
    tx_com_asset.asset_id = asset.id
    _pending_transaction(db_session, user, "Sem ativo")
    db_session.commit()

    items, total = service.list_transactions(db_session, user.id)

    assert total == 2


def test_list_transactions_filters_by_group_id(db_session, user, subcategory, other_subcategory):
    tx_grupo = _confirmed_transaction(db_session, user, subcategory, "Grupo alvo")
    _confirmed_transaction(db_session, user, other_subcategory, "Outro grupo")

    items, total = service.list_transactions(
        db_session, user.id, status="todas", group_id=subcategory.group_id
    )

    assert total == 1
    assert [tx.id for tx in items] == [tx_grupo.id]


def test_list_transactions_combines_has_asset_and_group_id(
    db_session, user, subcategory, other_subcategory
):
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    tx_match = _confirmed_transaction(db_session, user, subcategory, "Com ativo no grupo")
    tx_match.asset_id = asset.id
    tx_grupo_sem_ativo = _confirmed_transaction(db_session, user, subcategory, "Sem ativo no grupo")
    tx_outro_grupo = _confirmed_transaction(db_session, user, other_subcategory, "Outro grupo")
    tx_outro_grupo.asset_id = asset.id
    db_session.commit()
    del tx_grupo_sem_ativo, tx_outro_grupo

    items, total = service.list_transactions(
        db_session, user.id, status="todas", has_asset=True, group_id=subcategory.group_id
    )

    assert total == 1
    assert [tx.id for tx in items] == [tx_match.id]


def test_list_transactions_filters_by_account_id(db_session, user):
    tx_conta_alvo = _pending_transaction(db_session, user, "Conta alvo")
    _pending_transaction(db_session, user, "Outra conta")

    items, total = service.list_transactions(
        db_session, user.id, account_id=tx_conta_alvo.account_id
    )

    assert total == 1
    assert [tx.id for tx in items] == [tx_conta_alvo.id]


def test_list_transactions_combines_account_id_and_status(db_session, user, subcategory):
    tx_pendente = _pending_transaction(db_session, user, "Pendente conta alvo")
    tx_confirmada = _transaction(
        db_session,
        user,
        "Confirmada conta alvo",
        status_categorizacao=PluggyTransactionCategorizacaoStatus.confirmada,
        subcategory_id=subcategory.id,
    )
    tx_confirmada.account_id = tx_pendente.account_id
    db_session.commit()

    items, total = service.list_transactions(
        db_session, user.id, status="pendente", account_id=tx_pendente.account_id
    )

    assert total == 1
    assert [tx.id for tx in items] == [tx_pendente.id]


def test_list_transactions_account_id_cross_user_isolation(db_session, user, other_user):
    tx_other = _pending_transaction(db_session, other_user, "Conta do outro usuario")

    items, total = service.list_transactions(db_session, user.id, account_id=tx_other.account_id)

    assert items == []
    assert total == 0


# --- set_category --------------------------------------------------------


def test_set_category_sets_fields_and_removes_from_pending(db_session, user, subcategory):
    tx = _pending_transaction(db_session, user)

    confirmed = service.set_category(db_session, user.id, tx.id, subcategory.id)

    assert confirmed.subcategory_id == subcategory.id
    assert confirmed.categorizacao_status == PluggyTransactionCategorizacaoStatus.confirmada
    items, total = service.list_transactions(db_session, user.id, status="pendente")
    assert items == []
    assert total == 0


def test_set_category_on_already_confirmed_transaction_updates_it(
    db_session, user, subcategory, other_subcategory
):
    tx = _confirmed_transaction(db_session, user, subcategory, "Ja confirmada")

    updated = service.set_category(db_session, user.id, tx.id, other_subcategory.id)

    assert updated.subcategory_id == other_subcategory.id
    assert updated.categorizacao_status == PluggyTransactionCategorizacaoStatus.confirmada


def test_set_category_clears_stale_suggestion_on_confirm(
    db_session, user, subcategory, other_subcategory
):
    # Achado real: confirmar uma categoria diferente da última sugestão
    # calculada deixava subcategoria_sugerida_id "preso" na sugestão antiga,
    # e a UI prioriza esse campo sobre subcategory_id ao exibir o valor.
    tx = _transaction(
        db_session, user, "Mercado Sao Joao", subcategoria_sugerida_id=other_subcategory.id
    )

    confirmed = service.set_category(db_session, user.id, tx.id, subcategory.id)

    assert confirmed.subcategory_id == subcategory.id
    assert confirmed.subcategoria_sugerida_id is None


def test_set_category_missing_transaction_raises_not_found(db_session, user, subcategory):
    with pytest.raises(NotFoundError):
        service.set_category(db_session, user.id, 999, subcategory.id)


def test_set_category_other_users_transaction_raises_not_found(
    db_session, user, other_user, subcategory
):
    tx = _pending_transaction(db_session, other_user)

    with pytest.raises(NotFoundError):
        service.set_category(db_session, user.id, tx.id, subcategory.id)


def test_set_category_invalid_subcategory_raises_not_found(db_session, user):
    tx = _pending_transaction(db_session, user)

    with pytest.raises(NotFoundError):
        service.set_category(db_session, user.id, tx.id, 999)


# --- bulk_confirm ---------------------------------------------------------


def test_bulk_confirm_confirms_all_valid_rows(db_session, user, subcategory, other_subcategory):
    tx1 = _pending_transaction(db_session, user, "Um")
    tx2 = _pending_transaction(db_session, user, "Dois")

    results = service.bulk_confirm(
        db_session, user.id, [(tx1.id, subcategory.id), (tx2.id, other_subcategory.id)]
    )

    assert all(r.success for r in results)
    db_session.refresh(tx1)
    db_session.refresh(tx2)
    assert tx1.subcategory_id == subcategory.id
    assert tx1.categorizacao_status == PluggyTransactionCategorizacaoStatus.confirmada
    assert tx2.subcategory_id == other_subcategory.id


def test_bulk_confirm_invalid_row_does_not_block_the_rest(db_session, user, subcategory):
    tx_valid = _pending_transaction(db_session, user, "Valida")

    results = service.bulk_confirm(
        db_session, user.id, [(tx_valid.id, subcategory.id), (999, subcategory.id)]
    )

    by_id = {r.transaction_id: r for r in results}
    assert by_id[tx_valid.id].success is True
    assert by_id[999].success is False
    db_session.refresh(tx_valid)
    assert tx_valid.categorizacao_status == PluggyTransactionCategorizacaoStatus.confirmada


def test_bulk_confirm_invalid_subcategory_reports_failure_without_blocking_rest(
    db_session, user, subcategory
):
    tx_valid = _pending_transaction(db_session, user, "Valida")
    tx_invalid_subcat = _pending_transaction(db_session, user, "Categoria invalida")

    results = service.bulk_confirm(
        db_session, user.id, [(tx_valid.id, subcategory.id), (tx_invalid_subcat.id, 999)]
    )

    by_id = {r.transaction_id: r for r in results}
    assert by_id[tx_valid.id].success is True
    assert by_id[tx_invalid_subcat.id].success is False
    db_session.refresh(tx_invalid_subcat)
    assert tx_invalid_subcat.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente


def test_bulk_confirm_other_users_transaction_fails_without_leaking(
    db_session, user, other_user, subcategory
):
    tx_other = _pending_transaction(db_session, other_user, "De outro usuario")

    results = service.bulk_confirm(db_session, user.id, [(tx_other.id, subcategory.id)])

    assert results[0].success is False
    db_session.refresh(tx_other)
    assert tx_other.categorizacao_status == PluggyTransactionCategorizacaoStatus.pendente


# --- set_transaction_asset -------------------------------------------------


def test_set_transaction_asset_sets_and_clears(db_session, user):
    tx = _pending_transaction(db_session, user)
    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    updated = service.set_transaction_asset(db_session, user.id, tx.id, asset.id)
    assert updated.asset_id == asset.id

    cleared = service.set_transaction_asset(db_session, user.id, tx.id, None)
    assert cleared.asset_id is None


def test_set_transaction_asset_other_users_asset_raises_not_found(db_session, user, other_user):
    tx = _pending_transaction(db_session, user)
    asset = Asset(
        user_id=other_user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    with pytest.raises(NotFoundError):
        service.set_transaction_asset(db_session, user.id, tx.id, asset.id)


def test_set_transaction_asset_missing_transaction_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.set_transaction_asset(db_session, user.id, 999, None)


def test_set_transaction_asset_manual_clear_is_not_reapplied_by_suggestion(db_session, user):
    # Achado real: o motor de sugestão recalcula asset_sugerido_id a cada
    # list_transactions enquanto a transação segue pendente, repondo um
    # vínculo que o usuário acabou de remover manualmente.
    from app.models.categorization import AssetCategorizationRule

    asset = Asset(
        user_id=user.id,
        nome="Apartamento",
        tipo=AssetTipo.imovel,
        valor_atual=Decimal("100.00"),
        data_aquisicao=date(2020, 1, 1),
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)
    db_session.add(
        AssetCategorizationRule(
            user_id=user.id,
            asset_id=asset.id,
            padrao_descricao="Condominio Apto",
            padrao_normalizado="condominio apto",
            origem="usuario_confirmou",
        )
    )
    db_session.commit()
    tx = _pending_transaction(db_session, user, "Condominio Apto")

    service.set_transaction_asset(db_session, user.id, tx.id, asset.id)
    service.set_transaction_asset(db_session, user.id, tx.id, None)

    items, total = service.list_transactions(db_session, user.id, status="pendente")

    assert total == 1
    assert items[0].asset_id is None
    assert items[0].asset_sugerido_id is None


# --- set_transaction_liability ----------------------------------------------


def test_set_transaction_liability_sets_and_clears(db_session, user):
    tx = _pending_transaction(db_session, user)
    liability = Liability(
        user_id=user.id,
        nome="Financiamento",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()
    db_session.refresh(liability)

    updated = service.set_transaction_liability(db_session, user.id, tx.id, liability.id)
    assert updated.liability_id == liability.id
    assert updated.asset_id is None
    assert updated.subcategory_id is None

    cleared = service.set_transaction_liability(db_session, user.id, tx.id, None)
    assert cleared.liability_id is None


def test_set_transaction_liability_other_users_liability_raises_not_found(
    db_session, user, other_user
):
    tx = _pending_transaction(db_session, user)
    liability = Liability(
        user_id=other_user.id,
        nome="Financiamento",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()
    db_session.refresh(liability)

    with pytest.raises(NotFoundError):
        service.set_transaction_liability(db_session, user.id, tx.id, liability.id)


def test_set_transaction_liability_missing_transaction_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.set_transaction_liability(db_session, user.id, 999, None)


def test_set_transaction_liability_manual_clear_is_not_reapplied_by_suggestion(db_session, user):
    liability = Liability(
        user_id=user.id,
        nome="Financiamento",
        tipo=LiabilityTipo.financiamento,
        valor_total=Decimal("60000.00"),
        saldo_devedor=Decimal("30000.00"),
    )
    db_session.add(liability)
    db_session.commit()
    db_session.refresh(liability)
    tx = _pending_transaction(db_session, user, "Parcela Financiamento")

    service.set_transaction_liability(db_session, user.id, tx.id, liability.id)
    service.set_transaction_liability(db_session, user.id, tx.id, None)

    items, total = service.list_transactions(db_session, user.id, status="pendente")

    assert total == 1
    assert items[0].liability_id is None
    assert items[0].liability_sugerido_id is None


# --- set_transaction_investimento -------------------------------------------


def test_set_transaction_investimento_sets_and_clears(db_session, user):
    tx = _pending_transaction(db_session, user)
    investimento = Investimento(user_id=user.id, nome="Reserva de emergência")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)

    updated = service.set_transaction_investimento(db_session, user.id, tx.id, investimento.id)
    assert updated.investimento_id == investimento.id

    cleared = service.set_transaction_investimento(db_session, user.id, tx.id, None)
    assert cleared.investimento_id is None


def test_set_transaction_investimento_other_users_investimento_raises_not_found(
    db_session, user, other_user
):
    tx = _pending_transaction(db_session, user)
    investimento = Investimento(user_id=other_user.id, nome="Reserva de emergência")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)

    with pytest.raises(NotFoundError):
        service.set_transaction_investimento(db_session, user.id, tx.id, investimento.id)


def test_set_transaction_investimento_missing_transaction_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.set_transaction_investimento(db_session, user.id, 999, None)


def test_set_transaction_investimento_manual_clear_is_not_reapplied_by_suggestion(db_session, user):
    # Regressão do achado real do CEO: um Pix vinculado ao Tesouro Direto
    # Nubank não podia ser desassociado — set_transaction_investimento(None)
    # gravava investimento_id = NULL corretamente, mas o próximo
    # list_transactions recalculava investimento_sugerido_id pelo histórico
    # (regra casando pela descrição) e a UI, que prioriza a sugestão sobre o
    # valor real, voltava a mostrar o investimento como vinculado.
    from app.models.categorization import InvestimentoCategorizationRule

    investimento = Investimento(user_id=user.id, nome="Tesouro Direto Nubank")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)
    db_session.add(
        InvestimentoCategorizationRule(
            user_id=user.id,
            investimento_id=investimento.id,
            padrao_descricao="Pix recebido Marlon",
            padrao_normalizado="pix recebido marlon",
            origem="usuario_confirmou",
        )
    )
    db_session.commit()
    tx = _pending_transaction(db_session, user, "Pix recebido Marlon")

    service.set_transaction_investimento(db_session, user.id, tx.id, investimento.id)
    service.set_transaction_investimento(db_session, user.id, tx.id, None)

    items, total = service.list_transactions(db_session, user.id, status="pendente")

    assert total == 1
    assert items[0].investimento_id is None
    assert items[0].investimento_sugerido_id is None


# --- sugestão de investimento aplicada por list_transactions -----------------


def test_list_transactions_applies_investimento_suggestion_but_never_confirms(db_session, user):
    from app.models.categorization import InvestimentoCategorizationRule

    investimento = Investimento(user_id=user.id, nome="Reserva de emergência")
    db_session.add(investimento)
    db_session.commit()
    db_session.refresh(investimento)
    db_session.add(
        InvestimentoCategorizationRule(
            user_id=user.id,
            investimento_id=investimento.id,
            padrao_descricao="Aporte Nubank Investimentos",
            padrao_normalizado="aporte nubank investimentos",
            origem="usuario_confirmou",
        )
    )
    db_session.commit()
    tx = _pending_transaction(db_session, user, "Aporte Nubank Investimentos")

    items, total = service.list_transactions(db_session, user.id, status="pendente")

    assert total == 1
    result = items[0]
    assert result.id == tx.id
    assert result.investimento_sugerido_id == investimento.id
    assert result.investimento_sugestao_confianca == "alta"
    assert result.investimento_id is None


# --- update_description / propagation --------------------------------------


def test_update_description_sets_descricao_usuario_immediately(db_session, user, subcategory):
    tx = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")

    updated, propagated = service.update_description(db_session, user.id, tx.id, "Padaria do Zé")

    assert updated.descricao_usuario == "Padaria do Zé"
    assert propagated == 0


def test_update_description_propagates_to_identical_description_and_same_category(
    db_session, user, subcategory
):
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 5678")

    _, propagated = service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    assert propagated == 1
    db_session.refresh(candidato)
    assert candidato.descricao_sugerida == "Padaria do Zé"
    assert candidato.descricao_sugestao_origem_id == origem.id
    assert candidato.descricao_usuario is None  # não aplicado até aprovação


def test_update_description_does_not_propagate_to_different_description(
    db_session, user, subcategory
):
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    outro = _confirmed_transaction(db_session, user, subcategory, "Mercado Extra 9999")

    _, propagated = service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    assert propagated == 0
    db_session.refresh(outro)
    assert outro.descricao_sugerida is None


def test_update_description_does_not_propagate_to_different_category(db_session, user, other_user):
    grupo_a = _subcategory(db_session, user, nome="Alimentação")
    grupo_b = _subcategory(db_session, user, nome="Outra categoria")
    origem = _confirmed_transaction(db_session, user, grupo_a, "PADARIA DO ZE 1234")
    candidato_categoria_diferente = _confirmed_transaction(
        db_session, user, grupo_b, "Padaria do Ze 5678"
    )

    _, propagated = service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    assert propagated == 0
    db_session.refresh(candidato_categoria_diferente)
    assert candidato_categoria_diferente.descricao_sugerida is None


def test_update_description_never_crosses_user_id(db_session, user, other_user, subcategory):
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato_outro_usuario = _confirmed_transaction(
        db_session, other_user, subcategory, "Padaria do Ze 5678"
    )

    _, propagated = service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    assert propagated == 0
    db_session.refresh(candidato_outro_usuario)
    assert candidato_outro_usuario.descricao_sugerida is None


def test_update_description_matches_by_suggested_category_when_not_confirmed(
    db_session, user, subcategory
):
    origem = _transaction(
        db_session,
        user,
        "PADARIA DO ZE 1234",
        status_categorizacao=PluggyTransactionCategorizacaoStatus.pendente,
        subcategoria_sugerida_id=subcategory.id,
    )
    candidato = _transaction(
        db_session,
        user,
        "Padaria do Ze 5678",
        status_categorizacao=PluggyTransactionCategorizacaoStatus.pendente,
        subcategoria_sugerida_id=subcategory.id,
    )

    _, propagated = service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    assert propagated == 1
    db_session.refresh(candidato)
    assert candidato.descricao_sugerida == "Padaria do Zé"


def test_update_description_without_category_does_not_propagate(db_session, user):
    origem = _pending_transaction(db_session, user, "PADARIA DO ZE 1234")
    candidato = _pending_transaction(db_session, user, "Padaria do Ze 5678")

    _, propagated = service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    assert propagated == 0
    db_session.refresh(candidato)
    assert candidato.descricao_sugerida is None


def test_update_description_second_origin_does_not_overwrite_pending_suggestion(
    db_session, user, subcategory
):
    origem_1 = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 9999")

    service.update_description(db_session, user.id, origem_1.id, "Padaria do Zé (bairro)")
    db_session.refresh(candidato)
    assert candidato.descricao_sugerida == "Padaria do Zé (bairro)"
    assert candidato.descricao_sugestao_origem_id == origem_1.id

    # Uma segunda transação de origem com a MESMA descrição normalizada da
    # candidata (que já tem sugestão pendente) não deve sobrescrever a
    # sugestão já gravada — "a primeira grava, a segunda não sobrescreve".
    outra_origem = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 9999")
    service.update_description(db_session, user.id, outra_origem.id, "Outra sugestao")
    db_session.refresh(candidato)
    assert candidato.descricao_sugerida == "Padaria do Zé (bairro)"
    assert candidato.descricao_sugestao_origem_id == origem_1.id


def test_update_description_missing_transaction_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.update_description(db_session, user.id, 999, "Nova descricao")


def test_update_description_other_users_transaction_raises_not_found(db_session, user, other_user):
    tx = _pending_transaction(db_session, other_user)

    with pytest.raises(NotFoundError):
        service.update_description(db_session, user.id, tx.id, "Nova descricao")


# --- confirm/dismiss description suggestion --------------------------------


def test_confirm_description_suggestion_applies_and_clears(db_session, user, subcategory):
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 5678")
    service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    confirmed = service.confirm_description_suggestion(db_session, user.id, candidato.id)

    assert confirmed.descricao_usuario == "Padaria do Zé"
    assert confirmed.descricao_sugerida is None
    assert confirmed.descricao_sugestao_origem_id is None


def test_dismiss_description_suggestion_clears_without_applying(db_session, user, subcategory):
    origem = _confirmed_transaction(db_session, user, subcategory, "PADARIA DO ZE 1234")
    candidato = _confirmed_transaction(db_session, user, subcategory, "Padaria do Ze 5678")
    service.update_description(db_session, user.id, origem.id, "Padaria do Zé")

    dismissed = service.dismiss_description_suggestion(db_session, user.id, candidato.id)

    assert dismissed.descricao_usuario is None
    assert dismissed.descricao_sugerida is None
    assert dismissed.descricao_sugestao_origem_id is None


def test_confirm_description_suggestion_without_pending_raises_invalid_state(db_session, user):
    tx = _pending_transaction(db_session, user)

    with pytest.raises(InvalidStateError):
        service.confirm_description_suggestion(db_session, user.id, tx.id)


def test_dismiss_description_suggestion_without_pending_raises_invalid_state(db_session, user):
    tx = _pending_transaction(db_session, user)

    with pytest.raises(InvalidStateError):
        service.dismiss_description_suggestion(db_session, user.id, tx.id)


# --- competência de salário (set_category / bulk_confirm) -------------------


def test_set_category_salario_at_or_above_cutoff_shifts_data_competencia(db_session, user):
    salario = _salario_subcategory(db_session, user)
    tx = _pending_transaction(db_session, user)
    tx.data = date(2026, 1, 25)
    db_session.commit()

    confirmed = service.set_category(db_session, user.id, tx.id, salario.id)

    assert confirmed.data_competencia == date(2026, 2, 25)


def test_set_category_salario_below_cutoff_keeps_same_month(db_session, user):
    salario = _salario_subcategory(db_session, user)
    tx = _pending_transaction(db_session, user)
    tx.data = date(2026, 1, 10)
    db_session.commit()

    confirmed = service.set_category(db_session, user.id, tx.id, salario.id)

    assert confirmed.data_competencia == date(2026, 1, 10)


def test_set_category_non_salario_sets_competencia_equal_to_data(db_session, user, subcategory):
    tx = _pending_transaction(db_session, user)
    tx.data = date(2026, 1, 25)
    db_session.commit()

    confirmed = service.set_category(db_session, user.id, tx.id, subcategory.id)

    assert confirmed.data_competencia == date(2026, 1, 25)


def test_set_category_recategorizing_out_of_salario_resets_competencia(
    db_session, user, subcategory
):
    salario = _salario_subcategory(db_session, user)
    tx = _pending_transaction(db_session, user)
    tx.data = date(2026, 1, 30)
    db_session.commit()
    confirmed = service.set_category(db_session, user.id, tx.id, salario.id)
    assert confirmed.data_competencia == date(2026, 2, 28)

    reverted = service.set_category(db_session, user.id, tx.id, subcategory.id)

    assert reverted.data_competencia == date(2026, 1, 30)


def test_set_category_salario_uses_user_specific_cutoff(db_session, user, other_user):
    salario_user = _salario_subcategory(db_session, user)
    salario_other = _salario_subcategory(db_session, other_user)
    user.salario_competencia_cutoff_dia = 5
    db_session.commit()
    tx_user = _pending_transaction(db_session, user)
    tx_user.data = date(2026, 1, 10)
    tx_other = _pending_transaction(db_session, other_user)
    tx_other.data = date(2026, 1, 10)
    db_session.commit()

    confirmed_user = service.set_category(db_session, user.id, tx_user.id, salario_user.id)
    confirmed_other = service.set_category(db_session, other_user.id, tx_other.id, salario_other.id)

    # user tem cutoff=5 (10 >= 5 desloca); other_user usa o default 25 (10 < 25 não desloca).
    assert confirmed_user.data_competencia == date(2026, 2, 10)
    assert confirmed_other.data_competencia == date(2026, 1, 10)


def test_bulk_confirm_shifts_competencia_for_salario_rows_only(db_session, user, subcategory):
    salario = _salario_subcategory(db_session, user)
    tx_salario = _pending_transaction(db_session, user, "Salário mensal")
    tx_salario.data = date(2026, 1, 28)
    tx_outra = _pending_transaction(db_session, user, "Mercado")
    tx_outra.data = date(2026, 1, 28)
    db_session.commit()

    results = service.bulk_confirm(
        db_session, user.id, [(tx_salario.id, salario.id), (tx_outra.id, subcategory.id)]
    )

    assert all(r.success for r in results)
    db_session.refresh(tx_salario)
    db_session.refresh(tx_outra)
    assert tx_salario.data_competencia == date(2026, 2, 28)
    assert tx_outra.data_competencia == date(2026, 1, 28)


def test_confirm_description_suggestion_other_users_transaction_raises_not_found(
    db_session, user, other_user
):
    tx = _pending_transaction(db_session, other_user)

    with pytest.raises(NotFoundError):
        service.confirm_description_suggestion(db_session, user.id, tx.id)


# --- competência de cartão de crédito (set_category / bulk_confirm, Sprint 16) --


def test_set_category_credit_card_shifts_competencia_unconditionally(db_session, user, subcategory):
    tx = _transaction(db_session, user, account_tipo=PluggyAccountTipo.cartao_credito)
    tx.data = date(2026, 1, 5)
    db_session.commit()

    confirmed = service.set_category(db_session, user.id, tx.id, subcategory.id)

    assert confirmed.data_competencia == date(2026, 2, 5)
    assert confirmed.data_caixa == date(2026, 3, 5)


def test_set_category_credit_card_ignores_salario_cutoff(db_session, user):
    salario = _salario_subcategory(db_session, user)
    tx = _transaction(db_session, user, account_tipo=PluggyAccountTipo.cartao_credito)
    tx.data = date(2026, 1, 5)
    db_session.commit()

    confirmed = service.set_category(db_session, user.id, tx.id, salario.id)

    # Cartão sempre desloca por competencia_padrao, mesmo categorizado como
    # Salário (regra de cutoff não se aplica a cartão).
    assert confirmed.data_competencia == date(2026, 2, 5)


def test_set_category_non_credit_card_sets_data_caixa_equal_to_competencia(
    db_session, user, subcategory
):
    tx = _pending_transaction(db_session, user)
    tx.data = date(2026, 1, 25)
    db_session.commit()

    confirmed = service.set_category(db_session, user.id, tx.id, subcategory.id)

    assert confirmed.data_caixa == confirmed.data_competencia == date(2026, 1, 25)


def test_bulk_confirm_credit_card_shifts_competencia_and_caixa(db_session, user, subcategory):
    tx_cartao = _transaction(
        db_session, user, "Compra cartao", account_tipo=PluggyAccountTipo.cartao_credito
    )
    tx_cartao.data = date(2026, 1, 28)
    db_session.commit()

    results = service.bulk_confirm(db_session, user.id, [(tx_cartao.id, subcategory.id)])

    assert all(r.success for r in results)
    db_session.refresh(tx_cartao)
    assert tx_cartao.data_competencia == date(2026, 2, 28)
    assert tx_cartao.data_caixa == date(2026, 3, 28)


# --- update_data (edição manual de data, Sprint 18) --------------------------


def test_update_data_sets_data_and_flag_on_corrente_account(db_session, user):
    tx = _pending_transaction(db_session, user)
    tx.data = date(2026, 1, 15)
    db_session.commit()

    updated = service.update_data(db_session, user.id, tx.id, date(2026, 1, 13))

    assert updated.data == date(2026, 1, 13)
    assert updated.data_editada_manualmente is True
    assert updated.data_competencia == date(2026, 1, 13)
    assert updated.data_caixa == date(2026, 1, 13)


def test_update_data_recomputes_competencia_for_credit_card(db_session, user):
    tx = _transaction(db_session, user, account_tipo=PluggyAccountTipo.cartao_credito)
    tx.data = date(2026, 1, 15)
    db_session.commit()

    updated = service.update_data(db_session, user.id, tx.id, date(2026, 1, 13))

    assert updated.data == date(2026, 1, 13)
    assert updated.data_competencia == date(2026, 2, 13)
    assert updated.data_caixa == date(2026, 3, 13)


def test_update_data_recomputes_competencia_salario_when_confirmed(db_session, user):
    salario = _salario_subcategory(db_session, user)
    tx = _confirmed_transaction(db_session, user, salario, "Salário mensal")
    tx.data = date(2026, 1, 20)
    db_session.commit()

    # cutoff padrão é 25 — dia 10 (< cutoff) não desloca.
    updated = service.update_data(db_session, user.id, tx.id, date(2026, 1, 10))

    assert updated.data == date(2026, 1, 10)
    assert updated.data_competencia == date(2026, 1, 10)

    # dia 28 (>= cutoff) desloca pro mês seguinte.
    updated = service.update_data(db_session, user.id, tx.id, date(2026, 1, 28))

    assert updated.data_competencia == date(2026, 2, 28)


def test_update_data_rejects_future_date(db_session, user):
    tx = _pending_transaction(db_session, user)

    with pytest.raises(InvalidStateError):
        service.update_data(db_session, user.id, tx.id, date.today() + timedelta(days=1))


def test_update_data_missing_transaction_raises_not_found(db_session, user):
    with pytest.raises(NotFoundError):
        service.update_data(db_session, user.id, 999, date(2026, 1, 13))


def test_update_data_other_users_transaction_raises_not_found(db_session, user, other_user):
    tx = _pending_transaction(db_session, other_user)

    with pytest.raises(NotFoundError):
        service.update_data(db_session, user.id, tx.id, date(2026, 1, 13))
