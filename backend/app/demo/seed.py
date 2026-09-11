"""Gerador de massa de dados sintética para a conta demo (Sprint 37, PRD-037).

Cobre jan-set/2026 com receita/despesas fixas/variáveis/eventuais, fatura de
cartão, aportes de investimento, transferência interna, ativos/passivos com
despesa vinculada e orçamentos — o suficiente para navegar por todas as telas
do app sem depender de sync real da Pluggy (nenhuma chamada a
`pluggy_integration`/`PluggyClient` acontece aqui, tudo é inserido direto via
SQLAlchemy).

O último mês (setembro/2026) fica deliberadamente com `categorizacao_status`
pendente em toda transação de conta corrente/cartão — dá à fila de
Categorização trabalho real para revisar, em vez de uma conta demo já 100%
confirmada.
"""

import random
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.categories.seed import seed_categories_for_user
from app.categorization.competencia import caixa, competencia_padrao, competencia_salario
from app.models.asset import Asset, AssetTipo
from app.models.categorization import CategorizationRule
from app.models.category import CategoryGroup, Subcategory
from app.models.investimento import Investimento
from app.models.liability import Liability, LiabilityTipo
from app.models.pluggy import (
    PluggyAccount,
    PluggyAccountTipo,
    PluggyInvestment,
    PluggyInvestmentSnapshot,
    PluggyItem,
    PluggyItemStatus,
    PluggyTransaction,
    PluggyTransactionCategorizacaoStatus,
    PluggyTransactionStatus,
    PluggyTransactionTipo,
)
from app.models.user import User

_MESES = list(range(1, 10))  # jan..set/2026
_ULTIMO_MES = _MESES[-1]
_ANO = 2026

_SALARIO_VALOR = Decimal("8500.00")
_RENDIMENTO_VALOR = Decimal("80.00")
_TRANSFERENCIA_POUPANCA_VALOR = Decimal("500.00")
_APORTE_VALOR = Decimal("1000.00")

# (grupo, subcategoria, valor) — uma transação por mês em conta corrente.
_DESPESAS_FIXAS = [
    ("Moradia", "Condomínio", Decimal("650.00")),
    ("Moradia", "Energia", Decimal("220.00")),
    ("Moradia", "Gás", Decimal("80.00")),
    ("Moradia", "Internet", Decimal("120.00")),
    ("Comunicação", "Assinaturas", Decimal("60.00")),
    ("Comunicação", "Celular", Decimal("90.00")),
    ("Saúde", "Plano de saúde", Decimal("450.00")),
    ("Veículos", "Seguro veículo", Decimal("180.00")),
]

# (grupo, subcategoria, nº de lançamentos/mês, faixa de valor) — variam via rng.
_DESPESAS_VARIAVEIS = [
    ("Alimentação", "Supermercado", 4, (Decimal("120"), Decimal("300"))),
    ("Alimentação", "Comer fora", 4, (Decimal("40"), Decimal("120"))),
    ("Veículos", "Combustível", 2, (Decimal("200"), Decimal("350"))),
]

# (grupo, subcategoria, valor) — compras no cartão, várias por mês.
_COMPRAS_CARTAO = [
    ("Compras", "Eletrônicos", Decimal("350.00")),
    ("Compras", "Roupas", Decimal("180.00")),
    ("Lazer", "Ingressos", Decimal("90.00")),
    ("Saúde", "Farmácia", Decimal("70.00")),
    ("Compras", "Presentes", Decimal("120.00")),
]

_REGRAS_CATEGORIZACAO = [
    ("supermercado extra", "Alimentação", "Supermercado"),
    ("ifood", "Alimentação", "Comer fora"),
    ("posto shell", "Veículos", "Combustível"),
    ("netflix assinatura", "Comunicação", "Assinaturas"),
]


def _subcategory_id(db: Session, user_id: int, grupo_nome: str, subcategoria_nome: str) -> int:
    row = (
        db.query(Subcategory.id)
        .join(CategoryGroup, Subcategory.group_id == CategoryGroup.id)
        .filter(
            Subcategory.user_id == user_id,
            CategoryGroup.nome == grupo_nome,
            Subcategory.nome == subcategoria_nome,
        )
        .one()
    )
    return row[0]


def _seed_item(db: Session, user: User) -> PluggyItem:
    item = PluggyItem(
        user_id=user.id,
        pluggy_item_id=f"demo-item-{user.id}",
        connector_id=1,
        connector_name="Banco Demo",
        status=PluggyItemStatus.updated,
        cutoff_date=_data(1, 1),
    )
    db.add(item)
    db.flush()
    return item


def _seed_contas(db: Session, user: User, item: PluggyItem) -> dict[str, PluggyAccount]:
    contas = {
        "corrente": PluggyAccount(
            item_id=item.id,
            user_id=user.id,
            pluggy_account_id=f"demo-acc-{user.id}-corrente",
            tipo=PluggyAccountTipo.corrente,
            nome="Conta Corrente Demo",
            apelido="Corrente",
            saldo=Decimal("8000.00"),
            saldo_inicial=Decimal("8000.00"),
        ),
        "poupanca": PluggyAccount(
            item_id=item.id,
            user_id=user.id,
            pluggy_account_id=f"demo-acc-{user.id}-poupanca",
            tipo=PluggyAccountTipo.poupanca,
            nome="Poupança Demo",
            apelido="Poupança",
            saldo=Decimal("15000.00"),
            saldo_inicial=Decimal("15000.00"),
        ),
        "cartao": PluggyAccount(
            item_id=item.id,
            user_id=user.id,
            pluggy_account_id=f"demo-acc-{user.id}-cartao",
            tipo=PluggyAccountTipo.cartao_credito,
            nome="Cartão de Crédito Demo",
            apelido="Cartão",
            saldo=Decimal("0.00"),
            limite_credito=Decimal("6000.00"),
            fatura_vencimento=_data(_ULTIMO_MES, 10),
        ),
        "investimento": PluggyAccount(
            item_id=item.id,
            user_id=user.id,
            pluggy_account_id=f"demo-acc-{user.id}-investimento",
            tipo=PluggyAccountTipo.investimento,
            nome="Conta Investimentos Demo",
            apelido="Investimentos",
            saldo=Decimal("2000.00"),
            saldo_inicial=Decimal("2000.00"),
        ),
    }
    for conta in contas.values():
        db.add(conta)
    db.flush()
    return contas


def _seed_investimentos(
    db: Session, user: User, item: PluggyItem, conta_investimento: PluggyAccount
) -> list[Investimento]:
    investimentos = [
        Investimento(user_id=user.id, nome="Tesouro Direto Demo"),
        Investimento(user_id=user.id, nome="Ações Demo"),
    ]
    for investimento in investimentos:
        db.add(investimento)
    db.flush()

    conta_investimento.investimento_id = investimentos[0].id

    holdings_config = [
        (investimentos[0], "FIXED_INCOME", "CDB", Decimal("18000.00")),
        (investimentos[1], "EQUITY", "STOCK", Decimal("6000.00")),
    ]
    for investimento, tipo, subtipo, saldo_inicial in holdings_config:
        holding = PluggyInvestment(
            item_id=item.id,
            user_id=user.id,
            pluggy_investment_id=f"demo-inv-{user.id}-{investimento.id}",
            tipo=tipo,
            subtipo=subtipo,
            nome=investimento.nome,
            saldo_inicial=saldo_inicial,
            valor_atual=saldo_inicial,
            investimento_id=investimento.id,
        )
        db.add(holding)
        db.flush()

        # O aporte mensal batido aqui precisa ser o mesmo valor da transação
        # real "Aporte investimento demo" (conta corrente -> investimentos[0],
        # ver _seed_transacoes) — divergir os dois faz `rendimento_estimado`
        # (residual: saldo_atual - saldo_base - total_aportes) ficar
        # artificialmente negativo, porque o dinheiro "chega" na transação mas
        # o saldo do holding só cresceria por um aporte interno menor.
        aporte_real = _APORTE_VALOR if investimento is investimentos[0] else Decimal("0")

        saldo = saldo_inicial
        for mes in _MESES:
            crescimento = saldo_inicial * Decimal("0.008")
            saldo = saldo + crescimento + aporte_real
            db.add(
                PluggyInvestmentSnapshot(
                    investment_id=holding.id,
                    user_id=user.id,
                    ano_mes=f"{_ANO}-{mes:02d}",
                    saldo=saldo,
                    valorizacao=crescimento,
                    rendimento=crescimento,
                    aportes=aporte_real,
                    resgates=Decimal("0"),
                    confianca="real",
                )
            )
        holding.valor_atual = saldo
    db.flush()
    return investimentos


def _seed_assets(db: Session, user: User) -> dict[str, Asset]:
    assets = {
        "apartamento": Asset(
            user_id=user.id,
            nome="Apartamento Demo",
            tipo=AssetTipo.imovel,
            valor_atual=Decimal("450000.00"),
            data_aquisicao=_data(1, 15, ano=2020),
        ),
        "carro": Asset(
            user_id=user.id,
            nome="Carro Demo",
            tipo=AssetTipo.veiculo,
            valor_atual=Decimal("60000.00"),
            data_aquisicao=_data(6, 10, ano=2022),
        ),
        "notebook": Asset(
            user_id=user.id,
            nome="Notebook Demo",
            tipo=AssetTipo.outro,
            valor_atual=Decimal("5000.00"),
            data_aquisicao=_data(3, 1, ano=2023),
        ),
    }
    for asset in assets.values():
        db.add(asset)
    db.flush()
    return assets


def _seed_liabilities(db: Session, user: User) -> dict[str, Liability]:
    liabilities = {
        "financiamento_imovel": Liability(
            user_id=user.id,
            nome="Financiamento Apartamento Demo",
            tipo=LiabilityTipo.financiamento,
            valor_total=Decimal("400000.00"),
            saldo_devedor=Decimal("340000.00"),
        ),
        "financiamento_veiculo": Liability(
            user_id=user.id,
            nome="Financiamento Veículo Demo",
            tipo=LiabilityTipo.financiamento,
            valor_total=Decimal("50000.00"),
            saldo_devedor=Decimal("28000.00"),
        ),
    }
    for liability in liabilities.values():
        db.add(liability)
    db.flush()
    return liabilities


def _seed_categorization_rules(db: Session, user: User) -> None:
    for padrao, grupo, subcategoria in _REGRAS_CATEGORIZACAO:
        db.add(
            CategorizationRule(
                user_id=user.id,
                subcategory_id=_subcategory_id(db, user.id, grupo, subcategoria),
                padrao_descricao=padrao,
                padrao_normalizado=padrao,
                origem="demo",
            )
        )
    db.flush()


def _data(mes: int, dia: int, *, ano: int = _ANO) -> date:
    return date(ano, mes, dia)


def _seed_transacoes(
    db: Session,
    user: User,
    contas: dict[str, PluggyAccount],
    investimentos: list[Investimento],
    assets: dict[str, Asset],
    liabilities: dict[str, Liability],
    rng: random.Random,
) -> None:
    corrente = contas["corrente"]
    poupanca = contas["poupanca"]
    cartao = contas["cartao"]

    salario_id = _subcategory_id(db, user.id, "Receitas", "Salário")
    rendimento_id = _subcategory_id(db, user.id, "Receitas", "Rendimentos de investimentos")
    transferencia_id = _subcategory_id(
        db, user.id, "Transferência interna", "Transferência interna"
    )
    pagamento_fatura_id = _subcategory_id(
        db, user.id, "Transferência interna", "Pagamento de Fatura"
    )
    aporte_id = _subcategory_id(db, user.id, "Investimentos", "Aporte")
    financ_imovel_id = _subcategory_id(db, user.id, "Moradia", "Financiamento imóvel")
    financ_veiculo_id = _subcategory_id(db, user.id, "Veículos", "Financiamento veículo")
    manutencao_veiculo_id = _subcategory_id(db, user.id, "Veículos", "Manutenção veículo")
    viagens_id = _subcategory_id(db, user.id, "Lazer", "Viagens")

    counter = 0

    def next_id(prefix: str) -> str:
        nonlocal counter
        counter += 1
        return f"demo-tx-{user.id}-{prefix}-{counter}"

    def add_conta_tx(
        *,
        account: PluggyAccount,
        dia: int,
        mes: int,
        descricao: str,
        valor: Decimal,
        tipo: PluggyTransactionTipo,
        subcategory_id: int | None,
        pendente: bool,
        asset_id: int | None = None,
        liability_id: int | None = None,
        investimento_id: int | None = None,
    ) -> None:
        data = _data(mes, dia)
        tx = PluggyTransaction(
            account_id=account.id,
            user_id=user.id,
            pluggy_transaction_id=next_id(account.pluggy_account_id),
            descricao=descricao,
            valor=valor,
            tipo=tipo,
            data=data,
            status=PluggyTransactionStatus.efetivada,
            asset_id=asset_id,
            asset_confirmado_manualmente=asset_id is not None,
            liability_id=liability_id,
            liability_confirmado_manualmente=liability_id is not None,
            investimento_id=investimento_id,
            investimento_confirmado_manualmente=investimento_id is not None,
        )
        if pendente:
            tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.pendente
            tx.data_competencia = data
            tx.data_caixa = data
        else:
            tx.subcategory_id = subcategory_id
            tx.categorizacao_status = PluggyTransactionCategorizacaoStatus.confirmada
            if subcategory_id == salario_id:
                tx.data_competencia = competencia_salario(data, user.salario_competencia_cutoff_dia)
            else:
                tx.data_competencia = competencia_padrao(data, account.tipo)
            tx.data_caixa = caixa(tx.data_competencia, account.tipo)
        db.add(tx)

    for mes in _MESES:
        pendente = mes == _ULTIMO_MES

        add_conta_tx(
            account=corrente,
            dia=5,
            mes=mes,
            descricao="Salário",
            valor=_SALARIO_VALOR,
            tipo=PluggyTransactionTipo.credito,
            subcategory_id=salario_id,
            pendente=pendente,
        )
        add_conta_tx(
            account=corrente,
            dia=8,
            mes=mes,
            descricao="Rendimento investimento",
            valor=_RENDIMENTO_VALOR,
            tipo=PluggyTransactionTipo.credito,
            subcategory_id=rendimento_id,
            pendente=pendente,
        )

        for grupo, subcategoria, valor in _DESPESAS_FIXAS:
            add_conta_tx(
                account=corrente,
                dia=10,
                mes=mes,
                descricao=f"{subcategoria} demo",
                valor=-valor,
                tipo=PluggyTransactionTipo.debito,
                subcategory_id=_subcategory_id(db, user.id, grupo, subcategoria),
                pendente=pendente,
            )

        add_conta_tx(
            account=corrente,
            dia=10,
            mes=mes,
            descricao="Financiamento imóvel demo",
            valor=-Decimal("2200.00"),
            tipo=PluggyTransactionTipo.debito,
            subcategory_id=financ_imovel_id,
            pendente=pendente,
            liability_id=liabilities["financiamento_imovel"].id if not pendente else None,
        )
        add_conta_tx(
            account=corrente,
            dia=12,
            mes=mes,
            descricao="Financiamento veículo demo",
            valor=-Decimal("900.00"),
            tipo=PluggyTransactionTipo.debito,
            subcategory_id=financ_veiculo_id,
            pendente=pendente,
            liability_id=liabilities["financiamento_veiculo"].id if not pendente else None,
        )

        for grupo, subcategoria, quantidade, (minimo, maximo) in _DESPESAS_VARIAVEIS:
            for i in range(quantidade):
                valor = Decimal(str(round(float(rng.uniform(float(minimo), float(maximo))), 2)))
                add_conta_tx(
                    account=corrente,
                    dia=min(28, 3 + i * 6),
                    mes=mes,
                    descricao=f"{subcategoria} demo {i + 1}",
                    valor=-valor,
                    tipo=PluggyTransactionTipo.debito,
                    subcategory_id=_subcategory_id(db, user.id, grupo, subcategoria),
                    pendente=pendente,
                )

        if mes % 3 == 0:
            add_conta_tx(
                account=corrente,
                dia=20,
                mes=mes,
                descricao="Manutenção veículo demo",
                valor=-Decimal("320.00"),
                tipo=PluggyTransactionTipo.debito,
                subcategory_id=manutencao_veiculo_id,
                pendente=pendente,
                asset_id=assets["carro"].id if not pendente else None,
            )

        if mes == 7:
            add_conta_tx(
                account=corrente,
                dia=15,
                mes=mes,
                descricao="Viagem de férias demo",
                valor=-Decimal("3000.00"),
                tipo=PluggyTransactionTipo.debito,
                subcategory_id=viagens_id,
                pendente=pendente,
            )

        add_conta_tx(
            account=corrente,
            dia=25,
            mes=mes,
            descricao="Transferência para poupança demo",
            valor=-_TRANSFERENCIA_POUPANCA_VALOR,
            tipo=PluggyTransactionTipo.debito,
            subcategory_id=transferencia_id,
            pendente=pendente,
        )
        add_conta_tx(
            account=poupanca,
            dia=25,
            mes=mes,
            descricao="Transferência recebida demo",
            valor=_TRANSFERENCIA_POUPANCA_VALOR,
            tipo=PluggyTransactionTipo.credito,
            subcategory_id=transferencia_id,
            pendente=pendente,
        )

        add_conta_tx(
            account=corrente,
            dia=15,
            mes=mes,
            descricao="Aporte investimento demo",
            valor=-_APORTE_VALOR,
            tipo=PluggyTransactionTipo.debito,
            subcategory_id=aporte_id,
            pendente=pendente,
            investimento_id=investimentos[0].id if not pendente else None,
        )

        total_fatura = Decimal("0")
        for i, (grupo, subcategoria, valor) in enumerate(_COMPRAS_CARTAO):
            total_fatura += valor
            add_conta_tx(
                account=cartao,
                dia=min(28, 2 + i * 5),
                mes=mes,
                descricao=f"{subcategoria} cartão demo",
                valor=valor,
                tipo=PluggyTransactionTipo.debito,
                subcategory_id=_subcategory_id(db, user.id, grupo, subcategoria),
                pendente=pendente,
            )

        if not pendente:
            add_conta_tx(
                account=cartao,
                dia=9,
                mes=mes,
                descricao="Pagamento de fatura demo",
                valor=-total_fatura,
                tipo=PluggyTransactionTipo.credito,
                subcategory_id=pagamento_fatura_id,
                pendente=False,
            )
            add_conta_tx(
                account=corrente,
                dia=9,
                mes=mes,
                descricao="Pagamento de fatura cartão demo",
                valor=-total_fatura,
                tipo=PluggyTransactionTipo.debito,
                subcategory_id=pagamento_fatura_id,
                pendente=False,
            )


def seed_demo_data(db: Session, user: User) -> None:
    """Popula a conta demo com ~9 meses (jan-set/2026) de dado sintético
    cobrindo todas as telas do app. Idempotente na parte de categorias
    (`seed_categories_for_user`); as demais entidades assumem que o usuário
    ainda não tem dado transacional (chamado só por `get_or_create_demo_user`
    na primeira criação e por `reset_demo_data` logo após a limpeza)."""
    seed_categories_for_user(db, user.id)
    db.flush()

    rng = random.Random(f"financeiro-demo-{user.id}")

    item = _seed_item(db, user)
    contas = _seed_contas(db, user, item)
    investimentos = _seed_investimentos(db, user, item, contas["investimento"])
    assets = _seed_assets(db, user)
    liabilities = _seed_liabilities(db, user)
    _seed_categorization_rules(db, user)
    _seed_transacoes(db, user, contas, investimentos, assets, liabilities, rng)

    db.commit()
