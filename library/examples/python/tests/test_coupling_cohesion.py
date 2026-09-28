from coupling_cohesion.after import Customer as AfterCustomer
from coupling_cohesion.after import LoyaltyTier as AfterLoyaltyTier
from coupling_cohesion.after import MigratedCustomer as AfterMigratedCustomer
from coupling_cohesion.after import Order as AfterOrder
from coupling_cohesion.after import OrderService as AfterOrderService
from coupling_cohesion.before import Customer as BeforeCustomer
from coupling_cohesion.before import LoyaltyTier as BeforeLoyaltyTier
from coupling_cohesion.before import MigratedCustomer as BeforeMigratedCustomer
from coupling_cohesion.before import Order as BeforeOrder
from coupling_cohesion.before import OrderService as BeforeOrderService


def test_before_cancellation_fee_and_loyalty_discount_read_the_customers_fields_directly() -> None:
    gold = BeforeCustomer(tier="gold", lifetime_spend_minor=50_000, years_as_member=1)
    order = BeforeOrder(amount_minor=10_000, customer=gold)
    service = BeforeOrderService()
    assert service.cancellation_fee(order) == 8_000
    assert service.loyalty_discount(gold) == 2000

    big_spender = BeforeCustomer(tier="bronze", lifetime_spend_minor=150_000, years_as_member=0)
    assert service.loyalty_discount(big_spender) == 1000


def test_before_a_migrated_customer_representation_needs_its_own_order_service_method() -> None:
    migrated = BeforeMigratedCustomer(
        tier=BeforeLoyaltyTier.GOLD, lifetime_spend_minor=50_000, years_as_member=1
    )
    service = BeforeOrderService()
    # Customer's tier became a value type; OrderService had to gain a whole new method to read
    # it - the change cost of reaching into Customer's representation instead of asking it.
    assert service.migrated_loyalty_discount(migrated) == 2000


def test_after_cancellation_fee_asks_the_customer_for_its_own_discount() -> None:
    gold = AfterCustomer(tier="gold", lifetime_spend_minor=50_000, years_as_member=1)
    order = AfterOrder(amount_minor=10_000, customer=gold)
    service = AfterOrderService()
    assert service.cancellation_fee(order) == 8_000
    assert service.loyalty_discount(gold) == 2000

    big_spender = AfterCustomer(tier="bronze", lifetime_spend_minor=150_000, years_as_member=0)
    assert service.loyalty_discount(big_spender) == 1000


def test_after_order_service_needs_no_changes_for_a_migrated_customer_representation() -> None:
    migrated = AfterMigratedCustomer(
        tier=AfterLoyaltyTier.GOLD, lifetime_spend_minor=50_000, years_as_member=1
    )
    order = AfterOrder(amount_minor=10_000, customer=migrated)
    service = AfterOrderService()
    # Same OrderService code, unedited, gives the same answer for the new representation.
    assert service.cancellation_fee(order) == 8_000
    assert service.loyalty_discount(migrated) == 2000
