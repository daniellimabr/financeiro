from datetime import date
from decimal import Decimal

import pytest

from app.exceptions import InvalidStateError, NotFoundError
from app.models.category import CategoryGroup, Natureza, Subcategory
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User
from app.planejamento import service

_SEQ = iter(range(1, 100_000))

ANO_BASE = 2026
MES_BASE = 6  # junho/2026 — histórico em mar/abr/mai, futuro até dez/2026


@pytest.fixture()
def user(db_session):
    n = next(_SEQ)
    u = User(google_sub=f"google-{n}", email=f"user{n}@example.com", name="Alice")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _group(db_session, user, nome=None, excluir_de_totais=False):
    group = CategoryGroup(
        user_id=user.id, nome=nome or f"Grupo {next(_SEQ)}", excluir_de_totais=excluir_de_totais
    )
    db_session.add(group)
    db_session.flush()
    return group


def _subcategory(db_session, user, group=None, nome=None, natureza=None):
    group = group or _group(db_session, user)
    s = Subcategory(
        user_id=user.id, group_id=group.id, nome=nome or f"Sub {next(_SEQ)}", natureza=natureza
    )
    db_session.add(s)
    db_session.flush()
    return s


def _account(db_session, user, tipo=PluggyAccountTipo.corrente):
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
        tipo=tipo,
        nome="Conta",
        saldo=Decimal("0"),
    )
    db_session.add(account)
    db_session.flush()
    return account


def _transaction(db_session, user, account, subcategory, *, valor, tipo, ano, mes, dia=10):
    n = next(_SEQ)
    tx = PluggyTransaction(
        account_id=account.id,
        user_id=user.id,
        pluggy_transaction_id=f"tx-{n}",
        descricao=f"Transacao {n}",
        valor=Decimal(valor),
        tipo=tipo,
        data=date(ano, mes, dia),
        data_competencia=date(ano, mes, dia),
        subcategory_id=subcategory.id,
        status=PluggyTransactionStatus.efetivada,
    )
    db_session.add(tx)
    db_session.flush()
    return tx


# --- _sugestao_media_3_meses --------------------------------------------------


def test_sugestao_media_ignora_mes_sem_transacao(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    # mar/2026: 100 | abr/2026: nada | mai/2026: 200
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=3,
    )
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-200.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    sugestao = service._sugestao_media_3_meses(
        db_session, user.id, sub.id, PluggyTransactionTipo.debito, ANO_BASE, MES_BASE
    )

    assert sugestao == Decimal("150.00")


def test_sugestao_zero_sem_historico(db_session, user):
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)

    sugestao = service._sugestao_media_3_meses(
        db_session, user.id, sub.id, PluggyTransactionTipo.debito, ANO_BASE, MES_BASE
    )

    assert sugestao == Decimal("0")


def test_sugestao_respeita_exclusao_de_totais(db_session, user):
    account = _account(db_session, user)
    group = _group(db_session, user, excluir_de_totais=True)
    sub = _subcategory(db_session, user, group=group, natureza=Natureza.variavel)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    sugestao = service._sugestao_media_3_meses(
        db_session, user.id, sub.id, PluggyTransactionTipo.debito, ANO_BASE, MES_BASE
    )

    assert sugestao == Decimal("0")


# --- get_grade — células sugeridas/confirmadas -------------------------------


def test_celula_futura_sem_override_e_sugerida_e_recalcula_com_historico(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user, nome="Mercado", natureza=Natureza.variavel)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)
    futuro = linha.celulas[4]  # jul/2026, primeiro mês futuro
    assert futuro.origem == "sugerido"
    assert futuro.valor == Decimal("100.00")

    # Histórico muda (nova transação em mai/2026) — sugestão recalcula sem
    # nenhuma persistência intermediária.
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )
    grade2 = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha2 = next(row for row in grade2.subcategorias if row.subcategory_id == sub.id)
    assert linha2.celulas[4].valor == Decimal("400.00")


def test_confirmar_valor_persiste_e_sobrevive_a_nova_consulta(db_session, user):
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    service.confirmar_valor(db_session, user.id, sub.id, ano=2026, mes=7, valor=Decimal("999.00"))

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)
    celula_confirmada = next(c for c in linha.celulas if (c.ano, c.mes) == (2026, 7))
    assert celula_confirmada.origem == "confirmado"
    assert celula_confirmada.valor == Decimal("999.00")

    # Editar de novo — upsert, não duplica.
    service.confirmar_valor(db_session, user.id, sub.id, ano=2026, mes=7, valor=Decimal("500.00"))
    grade2 = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha2 = next(row for row in grade2.subcategorias if row.subcategory_id == sub.id)
    celula2 = next(c for c in linha2.celulas if (c.ano, c.mes) == (2026, 7))
    assert celula2.valor == Decimal("500.00")


def test_remover_valor_volta_a_sugestao(db_session, user):
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )
    service.confirmar_valor(db_session, user.id, sub.id, ano=2026, mes=7, valor=Decimal("999.00"))

    service.remover_valor(db_session, user.id, sub.id, ano=2026, mes=7)

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)
    celula = next(c for c in linha.celulas if (c.ano, c.mes) == (2026, 7))
    assert celula.origem == "sugerido"
    assert celula.valor == Decimal("100.00")


def test_remover_valor_inexistente_levanta_not_found(db_session, user):
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)

    with pytest.raises(NotFoundError):
        service.remover_valor(db_session, user.id, sub.id, ano=2026, mes=7)


# --- mês corrente: realizado parcial + status ---------------------------------


def test_status_mes_corrente_despesa_excedido_e_dentro(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    for mes in (3, 4, 5):
        _transaction(
            db_session,
            user,
            account,
            sub,
            valor="-100.00",
            tipo=PluggyTransactionTipo.debito,
            ano=2026,
            mes=mes,
        )
    # sugestão do mês corrente = 100.00
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-150.00",
        tipo=PluggyTransactionTipo.debito,
        ano=ANO_BASE,
        mes=MES_BASE,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)
    atual = linha.celulas[3]
    assert atual.valor == Decimal("100.00")
    assert atual.realizado_parcial == Decimal("150.00")
    assert atual.status == "alerta"


def test_status_mes_corrente_receita_nao_alcancado_e_dentro(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user, natureza=Natureza.fixa)
    for mes in (3, 4, 5):
        _transaction(
            db_session,
            user,
            account,
            sub,
            valor="1000.00",
            tipo=PluggyTransactionTipo.credito,
            ano=2026,
            mes=mes,
        )
    # sugestão do mês corrente = 1000.00; realizado até agora fica abaixo —
    # receita: não alcançar é o alerta.
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="600.00",
        tipo=PluggyTransactionTipo.credito,
        ano=ANO_BASE,
        mes=MES_BASE,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)
    atual = linha.celulas[3]
    assert atual.status == "alerta"

    # Realizado alcança/ultrapassa a sugestão — dentro do planejado.
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="500.00",
        tipo=PluggyTransactionTipo.credito,
        ano=ANO_BASE,
        mes=MES_BASE,
    )
    grade2 = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha2 = next(row for row in grade2.subcategorias if row.subcategory_id == sub.id)
    assert linha2.celulas[3].status == "dentro"


# --- isolamento por usuário / filtro de natureza ------------------------------


def test_get_grade_isolado_por_usuario(db_session, user):
    other = User(google_sub="google-other-planej", email="other-planej@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    account_other = _account(db_session, other)
    sub_other = _subcategory(db_session, other, natureza=Natureza.variavel)
    _transaction(
        db_session,
        other,
        account_other,
        sub_other,
        valor="-999.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )
    service.confirmar_valor(
        db_session, other.id, sub_other.id, ano=2026, mes=7, valor=Decimal("999.00")
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    assert grade.subcategorias == []
    assert grade.itens == []


def test_subcategoria_eventual_ou_sem_natureza_nunca_aparece_na_grade(db_session, user):
    account = _account(db_session, user)
    sub_eventual = _subcategory(db_session, user, nome="Viagem", natureza=Natureza.eventual)
    sub_sem_natureza = _subcategory(db_session, user, nome="Diversos", natureza=None)
    for sub in (sub_eventual, sub_sem_natureza):
        _transaction(
            db_session,
            user,
            account,
            sub,
            valor="-100.00",
            tipo=PluggyTransactionTipo.debito,
            ano=2026,
            mes=5,
        )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    ids = {row.subcategory_id for row in grade.subcategorias}
    assert sub_eventual.id not in ids
    assert sub_sem_natureza.id not in ids


def test_subcategoria_fixa_sem_nenhuma_transacao_real_nao_aparece(db_session, user):
    _subcategory(db_session, user, nome="Nunca usada", natureza=Natureza.fixa)

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    assert grade.subcategorias == []


# --- CRUD de item planejado ----------------------------------------------------


def test_create_item_planejado_unico(db_session, user):
    item = service.create_item_planejado(
        db_session,
        user.id,
        nome="Presente de aniversário",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )

    assert item.id is not None
    assert item.recorrente is False


def test_create_item_planejado_unico_com_data_fim_levanta_invalid_state(db_session, user):
    with pytest.raises(InvalidStateError):
        service.create_item_planejado(
            db_session,
            user.id,
            nome="Item inválido",
            tipo=PluggyTransactionTipo.debito,
            valor=Decimal("300.00"),
            data_inicio=date(2026, 8, 1),
            recorrente=False,
            data_fim=date(2026, 12, 1),
        )


def test_create_item_planejado_recorrente_sem_data_fim(db_session, user):
    item = service.create_item_planejado(
        db_session,
        user.id,
        nome="Streaming novo",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("39.90"),
        data_inicio=date(2026, 7, 1),
        recorrente=True,
        data_fim=None,
    )

    assert item.recorrente is True
    assert item.data_fim is None


def test_update_e_delete_item_planejado(db_session, user):
    item = service.create_item_planejado(
        db_session,
        user.id,
        nome="Curso",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("100.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )

    updated = service.update_item_planejado(
        db_session,
        user.id,
        item.id,
        nome="Curso de inglês",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("150.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )
    assert updated.nome == "Curso de inglês"
    assert updated.valor == Decimal("150.00")

    service.delete_item_planejado(db_session, user.id, item.id)
    with pytest.raises(NotFoundError):
        service.get_item_planejado(db_session, user.id, item.id)


# --- vínculo/desvínculo com transação real -------------------------------------


def test_vincular_e_desvincular_item_planejado(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=8,
    )
    item = service.create_item_planejado(
        db_session,
        user.id,
        nome="Presente",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )

    vinculado = service.vincular_item_planejado(db_session, user.id, item.id, transacao_id=tx.id)
    assert vinculado.transacao_vinculada_id == tx.id

    desvinculado = service.desvincular_item_planejado(db_session, user.id, item.id)
    assert desvinculado.transacao_vinculada_id is None


def test_vincular_rejeita_transacao_de_outro_usuario(db_session, user):
    other = User(google_sub="google-other-vinculo", email="other-vinculo@example.com", name="Bob")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    account_other = _account(db_session, other)
    sub_other = _subcategory(db_session, other)
    tx_other = _transaction(
        db_session,
        other,
        account_other,
        sub_other,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=8,
    )
    item = service.create_item_planejado(
        db_session,
        user.id,
        nome="Presente",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )

    with pytest.raises(NotFoundError):
        service.vincular_item_planejado(db_session, user.id, item.id, transacao_id=tx_other.id)


def test_vincular_rejeita_transacao_ja_vinculada_a_outro_item(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=8,
    )
    item1 = service.create_item_planejado(
        db_session,
        user.id,
        nome="Item 1",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )
    item2 = service.create_item_planejado(
        db_session,
        user.id,
        nome="Item 2",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )
    service.vincular_item_planejado(db_session, user.id, item1.id, transacao_id=tx.id)

    with pytest.raises(InvalidStateError):
        service.vincular_item_planejado(db_session, user.id, item2.id, transacao_id=tx.id)


# --- itens planejados na grade --------------------------------------------------


def test_item_planejado_unico_aparece_so_no_mes_alvo(db_session, user):
    service.create_item_planejado(
        db_session,
        user.id,
        nome="Presente",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    assert len(grade.itens) == 1
    linha = grade.itens[0]
    aplicaveis = [c for c in linha.celulas if c.origem != "vazio"]
    assert len(aplicaveis) == 1
    assert (aplicaveis[0].ano, aplicaveis[0].mes) == (2026, 8)
    assert aplicaveis[0].origem == "hipotetico"


def test_item_planejado_recorrente_capado_pelo_horizonte(db_session, user):
    # Recorrente sem data_fim, começando no primeiro mês futuro — "ad
    # eternum" é capado pelos 6 meses futuros exibidos, não além.
    service.create_item_planejado(
        db_session,
        user.id,
        nome="Streaming",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("39.90"),
        data_inicio=date(2026, 7, 1),
        recorrente=True,
        data_fim=None,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    linha = grade.itens[0]
    aplicaveis = [c for c in linha.celulas if c.origem != "vazio"]
    assert len(aplicaveis) == 6
    assert (aplicaveis[0].ano, aplicaveis[0].mes) == (2026, 7)
    assert (aplicaveis[-1].ano, aplicaveis[-1].mes) == (2026, 12)


def test_item_planejado_cumprido_para_de_contar_como_hipotetico(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user)
    tx = _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-300.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=8,
    )
    item = service.create_item_planejado(
        db_session,
        user.id,
        nome="Presente",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 8, 1),
        recorrente=False,
        data_fim=None,
    )

    grade_antes = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    assert grade_antes.itens[0].cumprido is False
    assert (
        grade_antes.itens[0].celulas[5].origem == "hipotetico"
    )  # ago/2026 é o índice 5 do período

    service.vincular_item_planejado(db_session, user.id, item.id, transacao_id=tx.id)

    grade_depois = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    assert grade_depois.itens[0].cumprido is True
    assert grade_depois.itens[0].celulas[5].origem == "cumprido"


# --- propagação da confirmação de sugestão pros meses seguintes ---------------


def test_confirmar_valor_sugerido_propaga_para_meses_seguintes(db_session, user):
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    # jul/2026 (idx4) ainda está sugerido — confirmar propaga até o fim do
    # horizonte futuro (6 meses: jul..dez/2026, idx4..idx9).
    service.confirmar_valor(db_session, user.id, sub.id, ano=2026, mes=7, valor=Decimal("999.00"))

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)

    for idx in range(4, 10):
        assert linha.celulas[idx].valor == Decimal("999.00")
        assert linha.celulas[idx].origem == "confirmado"
    # Mês corrente (idx3), antes do mês editado, não é afetado.
    assert linha.celulas[3].origem == "sugerido"


def test_confirmar_valor_ja_confirmado_corrige_so_aquele_mes(db_session, user):
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    service.confirmar_valor(db_session, user.id, sub.id, ano=2026, mes=7, valor=Decimal("999.00"))
    # Reeditar um mês já confirmado é correção pontual — não repropaga.
    service.confirmar_valor(db_session, user.id, sub.id, ano=2026, mes=7, valor=Decimal("500.00"))

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)

    assert linha.celulas[4].valor == Decimal("500.00")  # jul — corrigido
    assert linha.celulas[5].valor == Decimal("999.00")  # ago — valor da propagação original


# --- linha-lembrete Eventual ----------------------------------------------------


def test_linha_eventual_agrega_todas_as_subcategorias_eventual(db_session, user):
    account = _account(db_session, user)
    sub1 = _subcategory(db_session, user, nome="Viagem", natureza=Natureza.eventual)
    sub2 = _subcategory(db_session, user, nome="Presente", natureza=Natureza.eventual)
    _transaction(
        db_session,
        user,
        account,
        sub1,
        valor="-1000.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )
    _transaction(
        db_session,
        user,
        account,
        sub2,
        valor="-200.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    eventual_despesa = next(e for e in grade.eventuais if e.tipo == PluggyTransactionTipo.debito)
    assert eventual_despesa.celulas[2].valor == Decimal("1200.00")  # mai/2026: 1000+200
    assert eventual_despesa.celulas[4].origem == "sugerido"
    assert eventual_despesa.celulas[4].valor == Decimal("1200.00")  # única transação no divisor


def test_linha_eventual_ausente_sem_nenhuma_subcategoria_eventual(db_session, user):
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    account = _account(db_session, user)
    _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    assert grade.eventuais == []


# --- totais por seção e saldo ---------------------------------------------------


def test_total_despesas_inclui_item_hipotetico_mas_nao_cumprido(db_session, user):
    account = _account(db_session, user)
    sub = _subcategory(db_session, user, natureza=Natureza.variavel)
    tx = _transaction(
        db_session,
        user,
        account,
        sub,
        valor="-100.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )
    service.create_item_planejado(
        db_session,
        user.id,
        nome="Presente",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("300.00"),
        data_inicio=date(2026, 7, 1),
        recorrente=False,
        data_fim=None,
    )
    item_cumprido = service.create_item_planejado(
        db_session,
        user.id,
        nome="Conserto",
        tipo=PluggyTransactionTipo.debito,
        valor=Decimal("450.00"),
        data_inicio=date(2026, 7, 1),
        recorrente=False,
        data_fim=None,
    )
    service.vincular_item_planejado(db_session, user.id, item_cumprido.id, transacao_id=tx.id)

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)
    linha_sub = next(row for row in grade.subcategorias if row.subcategory_id == sub.id)

    # jul/2026 (idx4): só a subcategoria (sugestão=100) + item hipotético
    # (300) — o item cumprido (450) fica de fora, já contado via a
    # transação real vinculada.
    assert grade.total_despesas[4].valor == linha_sub.celulas[4].valor + Decimal("300.00")


def test_saldo_e_receitas_menos_despesas(db_session, user):
    account = _account(db_session, user)
    sub_despesa = _subcategory(db_session, user, nome="Mercado", natureza=Natureza.variavel)
    sub_receita = _subcategory(db_session, user, nome="Salario", natureza=Natureza.fixa)
    for mes in (3, 4, 5):
        _transaction(
            db_session,
            user,
            account,
            sub_despesa,
            valor="-100.00",
            tipo=PluggyTransactionTipo.debito,
            ano=2026,
            mes=mes,
        )
        _transaction(
            db_session,
            user,
            account,
            sub_receita,
            valor="1000.00",
            tipo=PluggyTransactionTipo.credito,
            ano=2026,
            mes=mes,
        )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    assert grade.saldo[4].valor == grade.total_receitas[4].valor - grade.total_despesas[4].valor
    assert grade.saldo[4].valor == Decimal("900.00")
    assert len(grade.saldo) == len(grade.periodo) == 10


def test_linha_eventual_receita_tambem_aparece_separada_da_despesa(db_session, user):
    account = _account(db_session, user)
    sub_despesa = _subcategory(db_session, user, nome="Viagem", natureza=Natureza.eventual)
    sub_receita = _subcategory(db_session, user, nome="Reembolso", natureza=Natureza.eventual)
    _transaction(
        db_session,
        user,
        account,
        sub_despesa,
        valor="-500.00",
        tipo=PluggyTransactionTipo.debito,
        ano=2026,
        mes=5,
    )
    _transaction(
        db_session,
        user,
        account,
        sub_receita,
        valor="700.00",
        tipo=PluggyTransactionTipo.credito,
        ano=2026,
        mes=5,
    )

    grade = service.get_grade(db_session, user.id, ano_base=ANO_BASE, mes_base=MES_BASE)

    assert len(grade.eventuais) == 2
    eventual_receita = next(e for e in grade.eventuais if e.tipo == PluggyTransactionTipo.credito)
    assert eventual_receita.celulas[4].valor == Decimal("700.00")
