from dataclasses import dataclass
from typing import Protocol

from layered_architecture.after.application import OrderNotFound
from layered_architecture.after.domain import OrderCannotBeCancelled


@dataclass
class CancelRequest:
    order_id: str  # arrives as a string, as it would from a web request


@dataclass
class CancelResponse:
    status: str  # "ok" | "invalid" | "not_found" | "rejected"
    message: str


class CancelOrderUseCase(Protocol):
    """What the handler depends on: the application layer, not any one implementation."""

    def execute(self, order_id: int) -> None: ...


def handle_cancel_request(request: CancelRequest, use_case: CancelOrderUseCase) -> CancelResponse:
    """Presentation layer: parse the request into a command, call the use case, shape a response."""
    if not request.order_id.isdigit():
        return CancelResponse("invalid", "order id must be a number")
    order_id = int(request.order_id)  # the command, once validated

    try:
        use_case.execute(order_id)
    except OrderNotFound:
        return CancelResponse("not_found", f"order {order_id} not found")
    except OrderCannotBeCancelled as error:
        return CancelResponse("rejected", str(error))
    return CancelResponse("ok", f"order {order_id} cancelled")
