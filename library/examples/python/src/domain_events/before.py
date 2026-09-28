"""before: cancel() calls three unrelated services inline — the aggregate imports all of them."""
from typing import Protocol


class OrderAlreadyCancelledError(Exception):
    pass


class InventoryService(Protocol):
    def release(self, order_id: int) -> None: ...


class Mailer(Protocol):
    def send_cancellation_email(self, order_id: int) -> None: ...


class LoyaltyLedger(Protocol):
    def record_cancellation(self, order_id: int) -> None: ...


class Order:
    """Depends on three collaborators just to change its own status."""

    def __init__(self, id: int, inventory: InventoryService, mailer: Mailer, loyalty: LoyaltyLedger) -> None:
        self.id = id
        self.status = "pending"
        self._inventory = inventory
        self._mailer = mailer
        self._loyalty = loyalty

    def cancel(self, reason: str) -> None:
        if self.status == "cancelled":
            raise OrderAlreadyCancelledError("order is already cancelled")
        # If any of these three calls raises, the ones before it already ran
        # and the ones after it never will — and status is set only at the end.
        self._inventory.release(self.id)
        self._mailer.send_cancellation_email(self.id)
        self._loyalty.record_cancellation(self.id)
        self.status = "cancelled"
