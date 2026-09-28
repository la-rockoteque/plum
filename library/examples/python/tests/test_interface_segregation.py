import pytest

from interface_segregation.after import CancelOrder as AfterCancelOrder
from interface_segregation.after import CancelOrderStore, Order as AfterOrder, OrderArchiver, OrderStoreAdapter
from interface_segregation.before import CancelOrder as BeforeCancelOrder
from interface_segregation.before import Order as BeforeOrder, OrderStoreV1, OrderStoreV2


class FakeOrderStoreV1:
    """Implements the fat interface CancelOrder depends on. get/save are the only
    methods CancelOrder calls; the rest exist only to satisfy the contract."""

    unused_stubs = ["delete", "list_by_customer", "export_csv", "audit_trail", "purge_older_than"]

    def __init__(self, orders: dict[int, BeforeOrder]) -> None:
        self._orders = orders

    def get(self, order_id: int) -> BeforeOrder:
        return self._orders[order_id]

    def save(self, order: BeforeOrder) -> None:
        self._orders[order.id] = order

    def delete(self, order_id: int) -> None:
        raise NotImplementedError("not used")

    def list_by_customer(self, customer_email: str) -> list[BeforeOrder]:
        raise NotImplementedError("not used")

    def export_csv(self) -> str:
        raise NotImplementedError("not used")

    def audit_trail(self, order_id: int) -> list[str]:
        raise NotImplementedError("not used")

    def purge_older_than(self, days: int) -> int:
        raise NotImplementedError("not used")


class FakeOrderStoreV2(FakeOrderStoreV1):
    """The fat interface grew an eighth method (archive). CancelOrder's own behaviour
    is unchanged, but its fake must grow with the interface -- one more unused stub."""

    unused_stubs = FakeOrderStoreV1.unused_stubs + ["archive"]

    def archive(self, order_id: int) -> None:
        raise NotImplementedError("not used")


def test_before_cancel_order_works_but_its_fake_stubs_five_unused_methods() -> None:
    orders = {1: BeforeOrder(1, "ada@example.com", 500)}
    store: OrderStoreV1 = FakeOrderStoreV1(orders)
    BeforeCancelOrder(store).execute(1)
    assert orders[1].status == "cancelled"
    assert len(FakeOrderStoreV1.unused_stubs) == 5
    with pytest.raises(NotImplementedError, match="not used"):
        store.delete(1)


def test_before_growing_the_fat_store_forces_the_cancel_test_fake_to_grow_too() -> None:
    orders = {1: BeforeOrder(1, "ada@example.com", 500)}
    store: OrderStoreV2 = FakeOrderStoreV2(orders)
    # Cancel order's own behaviour did not change -- it still only calls get and save.
    BeforeCancelOrder(store).execute(1)
    assert orders[1].status == "cancelled"
    # But the fake that satisfies the grown interface needed one more unused stub.
    assert len(FakeOrderStoreV2.unused_stubs) == len(FakeOrderStoreV1.unused_stubs) + 1
    with pytest.raises(NotImplementedError, match="not used"):
        store.archive(1)


class FakeCancelOrderStore:
    """Implements the narrow role interface CancelOrder actually depends on: exactly
    two methods, both real."""

    real_methods = ["get", "save"]

    def __init__(self, orders: dict[int, AfterOrder]) -> None:
        self._orders = orders

    def get(self, order_id: int) -> AfterOrder:
        return self._orders[order_id]

    def save(self, order: AfterOrder) -> None:
        self._orders[order.id] = order


def test_after_cancel_orders_fake_has_exactly_two_methods_both_real() -> None:
    orders = {1: AfterOrder(1, "ada@example.com", 500)}
    store: CancelOrderStore = FakeCancelOrderStore(orders)
    AfterCancelOrder(store).execute(1)
    assert orders[1].status == "cancelled"
    assert len(FakeCancelOrderStore.real_methods) == 2


def test_after_adding_a_role_interface_for_archiving_does_not_touch_cancel_order_or_its_fake() -> None:
    adapter = OrderStoreAdapter()
    adapter.save(AfterOrder(1, "ada@example.com", 500))
    archiver: OrderArchiver = adapter
    archiver.archive(1)
    assert adapter.get(1).status == "archived"
    # CancelOrder and its fake are exactly as declared above -- untouched by the new role.
    orders = {2: AfterOrder(2, "ada@example.com", 700)}
    store: CancelOrderStore = FakeCancelOrderStore(orders)
    AfterCancelOrder(store).execute(2)
    assert orders[2].status == "cancelled"
    assert len(FakeCancelOrderStore.real_methods) == 2
