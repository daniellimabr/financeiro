class DuplicateNameError(Exception):
    """Nome já existe (grupo ou subcategoria)."""


class NotFoundError(Exception):
    """Registro não encontrado ou não pertence ao usuário autenticado."""


class InvalidStateError(Exception):
    """Operação não permitida no estado atual do registro."""
