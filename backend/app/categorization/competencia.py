from calendar import monthrange
from datetime import date


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
