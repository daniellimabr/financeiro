from sqlalchemy.orm import Session

from app.models.category import CategoryGroup, Natureza, Subcategory

# Catálogo padrão para usuários novos — congelado a partir do catálogo global
# real capturado na migration 0018 (Sprint 30), quando categorias deixaram de
# ser globais e passaram a ser semeadas por usuário. Cada usuário edita sua
# própria cópia livremente a partir daqui, sem afetar os demais.
_CATALOGO_PADRAO: list[tuple[str, bool, list[tuple[str, Natureza | None]]]] = [
    (
        "Alimentação",
        False,
        [("Comer fora", Natureza.variavel), ("Supermercado", Natureza.variavel)],
    ),
    (
        "Compras",
        False,
        [
            ("Eletrônicos", None),
            ("Miudezas e diversos", None),
            ("Móveis", None),
            ("Outras", None),
            ("Presentes", None),
            ("Roupas", None),
        ],
    ),
    ("Comunicação", False, [("Assinaturas", Natureza.fixa), ("Celular", Natureza.fixa)]),
    ("Doações", False, [("Doações", None)]),
    ("Educação", False, [("Cursos", None), ("Eventos", None), ("Livros", None)]),
    ("Empréstimos", False, [("Empréstimos Concedidos", None)]),
    ("Impostos e taxas", False, [("Impostos e taxas", None)]),
    ("Investimentos", False, [("Aporte", None), ("Resgate", None)]),
    ("Lazer", False, [("Ingressos", None), ("Pelada", None), ("Viagens", None)]),
    (
        "Moradia",
        False,
        [
            ("Aluguel", Natureza.eventual),
            ("Condomínio", Natureza.fixa),
            ("Energia", Natureza.fixa),
            ("Financiamento imóvel", Natureza.fixa),
            ("Gás", Natureza.fixa),
            ("Internet", Natureza.fixa),
        ],
    ),
    ("Pets", False, [("Pets", None)]),
    (
        "Receitas",
        False,
        [
            ("Aluguel", Natureza.fixa),
            ("Descontos", None),
            ("Estornos", None),
            ("Outras", None),
            ("Recebimento de empréstimos", None),
            ("Reembolsos", None),
            ("Rendimentos de investimentos", None),
            ("Salário", Natureza.fixa),
            ("Venda de ativos", None),
        ],
    ),
    (
        "Saúde",
        False,
        [
            ("Academia", None),
            ("Consultas e exames", None),
            ("Cuidados Pessoais", None),
            ("Farmácia", None),
            ("Plano de saúde", None),
            ("Suplementos", None),
        ],
    ),
    ("Seguros não-veiculares", False, [("Seguros não-veiculares", None)]),
    (
        "Transferência interna",
        True,
        [("Pagamento de Fatura", None), ("Transferência interna", None)],
    ),
    (
        "Veículos",
        False,
        [
            ("Apps de transporte", None),
            ("Combustível", Natureza.variavel),
            ("Estacionamento e pedágio", None),
            ("Financiamento veículo", Natureza.fixa),
            ("Impostos veículo (IPVA e licenciamento)", None),
            ("Manutenção veículo", None),
            ("Multas", None),
            ("Seguro veículo", Natureza.fixa),
        ],
    ),
]


def seed_categories_for_user(db: Session, user_id: int) -> None:
    """Semeia a cópia de categorias/subcategorias de um usuário novo a partir
    do catálogo padrão congelado. Idempotente por nome: se o usuário já tem
    um grupo com o mesmo nome, não duplica."""
    for group_nome, excluir_de_totais, subcategorias in _CATALOGO_PADRAO:
        group = (
            db.query(CategoryGroup)
            .filter(CategoryGroup.user_id == user_id, CategoryGroup.nome == group_nome)
            .one_or_none()
        )
        if group is None:
            group = CategoryGroup(
                user_id=user_id, nome=group_nome, excluir_de_totais=excluir_de_totais
            )
            db.add(group)
            db.flush()

        for subcategoria_nome, natureza in subcategorias:
            existing = (
                db.query(Subcategory)
                .filter(Subcategory.user_id == user_id, Subcategory.group_id == group.id)
                .filter(Subcategory.nome == subcategoria_nome)
                .one_or_none()
            )
            if existing is None:
                db.add(
                    Subcategory(
                        user_id=user_id,
                        group_id=group.id,
                        nome=subcategoria_nome,
                        natureza=natureza,
                    )
                )
