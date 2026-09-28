# The rule, named and in one place instead of a bare comparison buried in cancel().
NON_CANCELLABLE_STATUSES = frozenset({"shipped"})


class Order:
    """Same public shape as green — same constructor, same status values — cleaner internals."""

    def __init__(self, status: str = "pending") -> None:
        self.status = status

    def can_cancel(self) -> bool:
        return self.status not in NON_CANCELLABLE_STATUSES

    def cancel(self) -> None:
        if not self.can_cancel():
            raise ValueError("a shipped order can't be cancelled")
        self.status = "cancelled"
