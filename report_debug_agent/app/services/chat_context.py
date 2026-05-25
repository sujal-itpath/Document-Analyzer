from contextvars import ContextVar
from typing import Iterable

allowed_sources_var: ContextVar[set[str] | None] = ContextVar("allowed_sources", default=None)

def set_allowed_sources(sources: Iterable[str] | None):
    if sources is None:
        return allowed_sources_var.set(None)
    normalized = {source for source in sources if source}
    return allowed_sources_var.set(normalized)

def reset_allowed_sources(token) -> None:
    allowed_sources_var.reset(token)

def get_allowed_sources() -> set[str] | None:
    return allowed_sources_var.get()
