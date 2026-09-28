"""before: a pluggable CancellationPolicy registry, hooks and a config flag — for one policy that exists."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Protocol

CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000
DEFAULT_POLICY_NAME = "standard"


class OrderStatus(str, Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


@dataclass
class Order:
    id: int
    status: OrderStatus
    placed_at_ms: int


class Clock(Protocol):
    def now_ms(self) -> int: ...


class CancellationPolicy(Protocol):
    def can_cancel(self, order: Order, clock: Clock) -> bool: ...


class StandardCancellationPolicy:
    """The only policy that has ever existed."""

    def can_cancel(self, order: Order, clock: Clock) -> bool:
        if order.status != OrderStatus.PENDING:
            return False
        return clock.now_ms() - order.placed_at_ms <= CANCELLATION_WINDOW_MS


@dataclass
class CancellationHooks:
    """Extension points nobody has ever wired up."""

    on_before_cancel: list[Callable[[Order], None]] = field(default_factory=list)
    on_after_cancel: list[Callable[[Order], None]] = field(default_factory=list)


class CancellationPolicyRegistry:
    """A pluggable seam for a second policy that has never shown up."""

    def __init__(self) -> None:
        self._policies: dict[str, CancellationPolicy] = {DEFAULT_POLICY_NAME: StandardCancellationPolicy()}

    def register(self, name: str, policy: CancellationPolicy) -> None:
        self._policies[name] = policy

    def resolve(self, name: str) -> CancellationPolicy:
        # A typo in `name` is silently swallowed: it just falls back to the default.
        return self._policies.get(name, self._policies[DEFAULT_POLICY_NAME])


class OrderCancellationService:
    def __init__(
        self,
        policy_name: str = DEFAULT_POLICY_NAME,
        hooks: CancellationHooks | None = None,
        strict_mode: bool = False,  # dead: no code path reads this flag
        registry: CancellationPolicyRegistry | None = None,
    ) -> None:
        self.hooks = hooks or CancellationHooks()
        self.strict_mode = strict_mode
        self._policy = (registry or CancellationPolicyRegistry()).resolve(policy_name)

    def can_cancel(self, order: Order, clock: Clock) -> bool:
        for hook in self.hooks.on_before_cancel:
            hook(order)
        result = self._policy.can_cancel(order, clock)
        for hook in self.hooks.on_after_cancel:
            hook(order)
        return result
