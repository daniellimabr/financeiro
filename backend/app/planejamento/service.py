from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.categories.service import get_subcategory
from app.dashboards.service import _apply_periodo, _base_query, _month_range, _to_decimal
from app.exceptions import InvalidStateError, NotFoundError
from app.models.category import CategoryGroup, Natureza, Subcategory
from app.models.planejamento import ItemPlanejado, PlanejamentoValor
from app.models.pluggy import PluggyTransaction, PluggyTransactionTipo

# Horizonte fixo desta sprint (decisão explícita do CEO) — 3 meses de
# histórico (leitura), mês corrente, 12 meses futuros = 16 colunas.
JANELA_SUGESTAO = 3
HORIZONTE_FUTURO = 12


@dataclass
class CelulaGrade:
    ano: int
    mes: int
    valor: Decimal
    # "realizado" (histórico, só leitura) | "sugerido" (pendente de
    # confirmação) | "confirmado" (override persistido) | "hipotetico" (item
    # planejado não vinculado) | "cumprido" (item planejado vinculado a uma
    # transação real) | "vazio" (item planejado fora do seu período/mês-alvo).
    origem: str
    realizado_parcial: Decimal | None = None
    status: str | None = None  # "dentro" | "alerta" — só a célula do mês corrente
    transacao_vinculada_id: int | None = None


@dataclass
class LinhaSubcategoriaGrade:
    subcategory_id: int
    subcategory_nome: str
    group_id: int
    group_nome: str
    tipo: PluggyTransactionTipo
    celulas: list[CelulaGrade] = field(default_factory=list)


@dataclass
class LinhaItemGrade:
    item_id: int
    nome: str
    tipo: PluggyTransactionTipo
    recorrente: bool
    cumprido: bool
    celulas: list[CelulaGrade] = field(default_factory=list)


@dataclass
class GradeOut:
    periodo: list[tuple[int, int]]
    subcategorias: list[LinhaSubcategoriaGrade]
    itens: list[LinhaItemGrade]


def _periodo_grade(ano_base: int, mes_base: int) -> list[tuple[int, int]]:
    """3 meses de histórico + mês corrente (via `_month_range`) seguidos de
    `HORIZONTE_FUTURO` meses futuros — 16 colunas no total."""
    periodo = _month_range(ano_base, mes_base, JANELA_SUGESTAO + 1)
    y, m = ano_base, mes_base
    for _ in range(HORIZONTE_FUTURO):
        m += 1
        if m == 13:
            m = 1
            y += 1
        periodo.append((y, m))
    return periodo


def _tipo_dominante(db: Session, user_id: int, subcategory_id: int) -> PluggyTransactionTipo | None:
    """Débito ou crédito — o que a subcategoria de fato movimenta, decidido
    pelo tipo com maior soma histórica (mesmas exclusões de todo dashboard).
    `None` quando a subcategoria nunca teve transação real: sem histórico não
    há como decidir o sentido do alerta do mês corrente, então ela fica fora
    da grade automática (o usuário ainda pode acompanhá-la via Item
    Planejado)."""
    row = (
        _base_query(db, user_id)
        .filter(PluggyTransaction.subcategory_id == subcategory_id)
        .with_entities(PluggyTransaction.tipo, func.sum(func.abs(PluggyTransaction.valor)))
        .group_by(PluggyTransaction.tipo)
        .order_by(func.sum(func.abs(PluggyTransaction.valor)).desc())
        .first()
    )
    return row[0] if row else None


def _total_mes(
    db: Session,
    user_id: int,
    subcategory_id: int,
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
) -> Decimal:
    query = _apply_periodo(_base_query(db, user_id), ano=ano, mes=mes).filter(
        PluggyTransaction.subcategory_id == subcategory_id,
        PluggyTransaction.tipo == tipo,
    )
    total = query.with_entities(
        func.coalesce(func.sum(func.abs(PluggyTransaction.valor)), 0)
    ).scalar()
    return _to_decimal(total)


def _sugestao_media_3_meses(
    db: Session,
    user_id: int,
    subcategory_id: int,
    tipo: PluggyTransactionTipo,
    ano: int,
    mes: int,
) -> Decimal:
    """Média dos últimos `JANELA_SUGESTAO` meses anteriores a (ano, mes) —
    só os meses com transação real entram no divisor (mês sem movimento não
    dilui a média); sem nenhum mês com transação, sugestão é 0. Valor
    constante, repetido em todo mês futuro sem override (mesma regra da
    antiga Projeção, PRD-014) — recalcula a cada chamada, nunca persiste."""
    meses_anteriores = _month_range(ano, mes, JANELA_SUGESTAO + 1)[:-1]
    totais = [
        total
        for y, m in meses_anteriores
        if (total := _total_mes(db, user_id, subcategory_id, tipo, y, m)) > 0
    ]
    if not totais:
        return Decimal("0")
    media = sum(totais) / len(totais)
    return media.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _valores_confirmados(
    db: Session, user_id: int, subcategory_id: int
) -> dict[tuple[int, int], Decimal]:
    rows = (
        db.query(PlanejamentoValor)
        .filter(
            PlanejamentoValor.user_id == user_id,
            PlanejamentoValor.subcategory_id == subcategory_id,
        )
        .all()
    )
    return {(v.ano, v.mes): v.valor for v in rows}


def _status_mes_corrente(
    tipo: PluggyTransactionTipo, planejado: Decimal, realizado_parcial: Decimal
) -> str:
    # Despesa: ultrapassar é o alerta. Receita: não alcançar é o alerta —
    # mesmo sentido de PRD-030.
    excedeu = (
        realizado_parcial > planejado
        if tipo == PluggyTransactionTipo.debito
        else realizado_parcial < planejado
    )
    return "alerta" if excedeu else "dentro"


def _linha_subcategoria(
    db: Session,
    user_id: int,
    subcategory: Subcategory,
    group_nome: str,
    *,
    ano_base: int,
    mes_base: int,
    periodo: list[tuple[int, int]],
) -> LinhaSubcategoriaGrade | None:
    tipo = _tipo_dominante(db, user_id, subcategory.id)
    if tipo is None:
        return None

    sugestao = _sugestao_media_3_meses(db, user_id, subcategory.id, tipo, ano_base, mes_base)
    confirmados = _valores_confirmados(db, user_id, subcategory.id)

    celulas: list[CelulaGrade] = []
    for idx, (y, m) in enumerate(periodo):
        if idx < JANELA_SUGESTAO:
            valor = _total_mes(db, user_id, subcategory.id, tipo, y, m)
            celulas.append(CelulaGrade(ano=y, mes=m, valor=valor, origem="realizado"))
            continue

        override = confirmados.get((y, m))
        valor = override if override is not None else sugestao
        origem = "confirmado" if override is not None else "sugerido"

        if idx == JANELA_SUGESTAO:  # mês corrente
            realizado_parcial = _total_mes(db, user_id, subcategory.id, tipo, y, m)
            status = _status_mes_corrente(tipo, valor, realizado_parcial)
            celulas.append(
                CelulaGrade(
                    ano=y,
                    mes=m,
                    valor=valor,
                    origem=origem,
                    realizado_parcial=realizado_parcial,
                    status=status,
                )
            )
        else:
            celulas.append(CelulaGrade(ano=y, mes=m, valor=valor, origem=origem))

    return LinhaSubcategoriaGrade(
        subcategory_id=subcategory.id,
        subcategory_nome=subcategory.nome,
        group_id=subcategory.group_id,
        group_nome=group_nome,
        tipo=tipo,
        celulas=celulas,
    )


def _mes_ordinal(ano: int, mes: int) -> int:
    return ano * 12 + mes


def _linha_item(item: ItemPlanejado, periodo: list[tuple[int, int]]) -> LinhaItemGrade:
    inicio_ord = _mes_ordinal(item.data_inicio.year, item.data_inicio.month)
    if item.recorrente:
        fim_ord = (
            _mes_ordinal(item.data_fim.year, item.data_fim.month)
            if item.data_fim is not None
            else _mes_ordinal(*periodo[-1])
        )
    else:
        fim_ord = inicio_ord

    celulas: list[CelulaGrade] = []
    for y, m in periodo:
        if inicio_ord <= _mes_ordinal(y, m) <= fim_ord:
            origem = "cumprido" if item.transacao_vinculada_id is not None else "hipotetico"
            celulas.append(
                CelulaGrade(
                    ano=y,
                    mes=m,
                    valor=item.valor,
                    origem=origem,
                    transacao_vinculada_id=item.transacao_vinculada_id,
                )
            )
        else:
            celulas.append(CelulaGrade(ano=y, mes=m, valor=Decimal("0"), origem="vazio"))

    return LinhaItemGrade(
        item_id=item.id,
        nome=item.nome,
        tipo=item.tipo,
        recorrente=item.recorrente,
        cumprido=item.transacao_vinculada_id is not None,
        celulas=celulas,
    )


def get_grade(db: Session, user_id: int, *, ano_base: int, mes_base: int) -> GradeOut:
    periodo = _periodo_grade(ano_base, mes_base)

    subcategorias = (
        db.query(Subcategory, CategoryGroup.nome)
        .join(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(
            Subcategory.user_id == user_id,
            Subcategory.natureza.in_([Natureza.fixa, Natureza.variavel]),
        )
        .order_by(CategoryGroup.nome, Subcategory.nome)
        .all()
    )

    linhas_subcategorias = []
    for subcategory, group_nome in subcategorias:
        linha = _linha_subcategoria(
            db,
            user_id,
            subcategory,
            group_nome,
            ano_base=ano_base,
            mes_base=mes_base,
            periodo=periodo,
        )
        if linha is not None:
            linhas_subcategorias.append(linha)

    itens = list_itens_planejados(db, user_id)
    linhas_itens = [_linha_item(item, periodo) for item in itens]

    return GradeOut(periodo=periodo, subcategorias=linhas_subcategorias, itens=linhas_itens)


def confirmar_valor(
    db: Session, user_id: int, subcategory_id: int, *, ano: int, mes: int, valor: Decimal
) -> PlanejamentoValor:
    get_subcategory(db, user_id, subcategory_id)
    existing = (
        db.query(PlanejamentoValor)
        .filter(
            PlanejamentoValor.user_id == user_id,
            PlanejamentoValor.subcategory_id == subcategory_id,
            PlanejamentoValor.ano == ano,
            PlanejamentoValor.mes == mes,
        )
        .one_or_none()
    )
    if existing is not None:
        existing.valor = valor
        db.commit()
        db.refresh(existing)
        return existing

    novo = PlanejamentoValor(
        user_id=user_id, subcategory_id=subcategory_id, ano=ano, mes=mes, valor=valor
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


def remover_valor(db: Session, user_id: int, subcategory_id: int, *, ano: int, mes: int) -> None:
    existing = (
        db.query(PlanejamentoValor)
        .filter(
            PlanejamentoValor.user_id == user_id,
            PlanejamentoValor.subcategory_id == subcategory_id,
            PlanejamentoValor.ano == ano,
            PlanejamentoValor.mes == mes,
        )
        .one_or_none()
    )
    if existing is None:
        raise NotFoundError(
            f"Nenhum valor confirmado para subcategoria {subcategory_id} em {mes}/{ano}"
        )
    db.delete(existing)
    db.commit()


def list_itens_planejados(db: Session, user_id: int) -> list[ItemPlanejado]:
    return (
        db.query(ItemPlanejado)
        .filter(ItemPlanejado.user_id == user_id)
        .order_by(ItemPlanejado.data_inicio, ItemPlanejado.id)
        .all()
    )


def get_item_planejado(db: Session, user_id: int, item_id: int) -> ItemPlanejado:
    item = (
        db.query(ItemPlanejado)
        .filter(ItemPlanejado.id == item_id, ItemPlanejado.user_id == user_id)
        .one_or_none()
    )
    if item is None:
        raise NotFoundError(f"Item planejado {item_id} não encontrado")
    return item


def _assert_data_fim_valida(*, recorrente: bool, data_fim: date | None) -> None:
    if data_fim is not None and not recorrente:
        raise InvalidStateError("data_fim só é válido para item planejado recorrente")


def create_item_planejado(
    db: Session,
    user_id: int,
    *,
    nome: str,
    tipo: PluggyTransactionTipo,
    valor: Decimal,
    data_inicio: date,
    recorrente: bool,
    data_fim: date | None,
) -> ItemPlanejado:
    _assert_data_fim_valida(recorrente=recorrente, data_fim=data_fim)
    item = ItemPlanejado(
        user_id=user_id,
        nome=nome,
        tipo=tipo,
        valor=valor,
        data_inicio=data_inicio,
        recorrente=recorrente,
        data_fim=data_fim,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_item_planejado(
    db: Session,
    user_id: int,
    item_id: int,
    *,
    nome: str,
    tipo: PluggyTransactionTipo,
    valor: Decimal,
    data_inicio: date,
    recorrente: bool,
    data_fim: date | None,
) -> ItemPlanejado:
    _assert_data_fim_valida(recorrente=recorrente, data_fim=data_fim)
    item = get_item_planejado(db, user_id, item_id)
    item.nome = nome
    item.tipo = tipo
    item.valor = valor
    item.data_inicio = data_inicio
    item.recorrente = recorrente
    item.data_fim = data_fim
    db.commit()
    db.refresh(item)
    return item


def delete_item_planejado(db: Session, user_id: int, item_id: int) -> None:
    item = get_item_planejado(db, user_id, item_id)
    db.delete(item)
    db.commit()


def vincular_item_planejado(
    db: Session, user_id: int, item_id: int, *, transacao_id: int
) -> ItemPlanejado:
    item = get_item_planejado(db, user_id, item_id)
    tx = (
        db.query(PluggyTransaction)
        .filter(PluggyTransaction.id == transacao_id, PluggyTransaction.user_id == user_id)
        .one_or_none()
    )
    if tx is None:
        raise NotFoundError(f"Transação {transacao_id} não encontrada")

    ja_vinculado = (
        db.query(ItemPlanejado)
        .filter(ItemPlanejado.transacao_vinculada_id == transacao_id, ItemPlanejado.id != item_id)
        .one_or_none()
    )
    if ja_vinculado is not None:
        raise InvalidStateError(
            f"Transação {transacao_id} já está vinculada a outro item planejado"
        )

    item.transacao_vinculada_id = transacao_id
    db.commit()
    db.refresh(item)
    return item


def desvincular_item_planejado(db: Session, user_id: int, item_id: int) -> ItemPlanejado:
    item = get_item_planejado(db, user_id, item_id)
    item.transacao_vinculada_id = None
    db.commit()
    db.refresh(item)
    return item
