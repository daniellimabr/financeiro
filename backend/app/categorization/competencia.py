from calendar import monthrange
from datetime import date

from app.models.pluggy import PluggyAccountTipo


def shift_to_next_month(d: date) -> date:
    year = d.year
    month = d.month + 1
    if month == 13:
        month = 1
        year += 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def competencia_salario(data: date, cutoff_dia: int) -> date:
    if data.day >= cutoff_dia:
        return shift_to_next_month(data)
    return data


def competencia_padrao(data: date, account_tipo: PluggyAccountTipo) -> date:
    """Competência de cartão de crédito desloca sempre 1 mês, incondicional
    (sem dia de corte, diferente de Salário) — demais tipos de conta não têm
    defasagem por padrão."""
    if account_tipo == PluggyAccountTipo.cartao_credito:
        return shift_to_next_month(data)
    return data


def caixa(data_competencia: date, account_tipo: PluggyAccountTipo) -> date:
    """Caixa de cartão de crédito fica mais 1 mês atrás da competência
    (evento + 2 meses no total) — demais tipos de conta não têm defasagem
    entre competência e caixa, mesmo quando a competência já foi deslocada
    pela regra de Salário."""
    if account_tipo == PluggyAccountTipo.cartao_credito:
        return shift_to_next_month(data_competencia)
    return data_competencia
