from datetime import date

from app.categorization.competencia import (
    caixa,
    competencia_padrao,
    competencia_salario,
    shift_to_next_month,
)
from app.models.pluggy import PluggyAccountTipo


def test_shift_to_next_month_same_year():
    assert shift_to_next_month(date(2026, 3, 10)) == date(2026, 4, 10)


def test_shift_to_next_month_rolls_over_year_at_december():
    assert shift_to_next_month(date(2025, 12, 20)) == date(2026, 1, 20)


def test_shift_to_next_month_clamps_day_overflow_to_february():
    assert shift_to_next_month(date(2026, 1, 31)) == date(2026, 2, 28)


def test_shift_to_next_month_clamps_day_overflow_to_leap_february():
    assert shift_to_next_month(date(2028, 1, 31)) == date(2028, 2, 29)


def test_competencia_salario_below_cutoff_stays_same_month():
    assert competencia_salario(date(2026, 1, 24), 25) == date(2026, 1, 24)


def test_competencia_salario_at_cutoff_shifts_to_next_month():
    assert competencia_salario(date(2026, 1, 25), 25) == date(2026, 2, 25)


def test_competencia_salario_above_cutoff_shifts_to_next_month():
    assert competencia_salario(date(2026, 1, 30), 25) == date(2026, 2, 28)


def test_competencia_salario_respects_custom_cutoff():
    assert competencia_salario(date(2026, 1, 10), 5) == date(2026, 2, 10)
    assert competencia_salario(date(2026, 1, 4), 5) == date(2026, 1, 4)


def test_competencia_salario_december_rollover():
    assert competencia_salario(date(2025, 12, 30), 25) == date(2026, 1, 30)


# --- competencia_padrao -------------------------------------------------


def test_competencia_padrao_cartao_shifts_unconditionally_early_in_month():
    assert competencia_padrao(date(2026, 1, 1), PluggyAccountTipo.cartao_credito) == date(
        2026, 2, 1
    )


def test_competencia_padrao_cartao_shifts_unconditionally_late_in_month():
    assert competencia_padrao(date(2026, 1, 31), PluggyAccountTipo.cartao_credito) == date(
        2026, 2, 28
    )


def test_competencia_padrao_corrente_has_no_shift():
    assert competencia_padrao(date(2026, 1, 15), PluggyAccountTipo.corrente) == date(2026, 1, 15)


def test_competencia_padrao_poupanca_has_no_shift():
    assert competencia_padrao(date(2026, 1, 15), PluggyAccountTipo.poupanca) == date(2026, 1, 15)


def test_competencia_padrao_investimento_has_no_shift():
    assert competencia_padrao(date(2026, 1, 15), PluggyAccountTipo.investimento) == date(
        2026, 1, 15
    )


# --- caixa ----------------------------------------------------------------


def test_caixa_cartao_shifts_one_more_month_past_competencia():
    competencia = competencia_padrao(date(2026, 1, 15), PluggyAccountTipo.cartao_credito)
    assert caixa(competencia, PluggyAccountTipo.cartao_credito) == date(2026, 3, 15)


def test_caixa_cartao_evento_mais_dois_meses_no_total():
    assert caixa(
        competencia_padrao(date(2026, 1, 15), PluggyAccountTipo.cartao_credito),
        PluggyAccountTipo.cartao_credito,
    ) == date(2026, 3, 15)


def test_caixa_non_cartao_equals_competencia():
    assert caixa(date(2026, 1, 15), PluggyAccountTipo.corrente) == date(2026, 1, 15)


def test_caixa_non_cartao_equals_competencia_even_when_shifted_by_salario():
    competencia_salario_deslocada = date(2026, 2, 25)
    assert (
        caixa(competencia_salario_deslocada, PluggyAccountTipo.corrente)
        == competencia_salario_deslocada
    )
