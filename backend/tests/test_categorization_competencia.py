from datetime import date

from app.categorization.competencia import competencia_salario, shift_to_next_month


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
