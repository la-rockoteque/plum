from single_responsibility.after.order import Order


class AuditLog:
    """Owns the audit entry format — its only reason to change."""

    def __init__(self) -> None:
        self.entries: list[str] = []

    def record_cancelled(self, order: Order, reason: str) -> None:
        self.entries.append(f"{order.id}|CANCELLED|{reason}")
