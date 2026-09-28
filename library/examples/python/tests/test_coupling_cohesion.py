from coupling_cohesion.after import Customer as AfterCustomer
from coupling_cohesion.after import Order as AfterOrder
from coupling_cohesion.after import OrderService as AfterOrderService
from coupling_cohesion.before import Customer as BeforeCustomer
from coupling_cohesion.before import Order as BeforeOrder
from coupling_cohesion.before import OrderService as BeforeOrderService


def test_before_cancellation_fee_reads_the_customers_tier_and_spend_directly() -> None:
    customer = BeforeCustomer(tier="gold", lifetime_spend=500, years_as_member=1)
    order = BeforeOrder(amount=100, customer=customer)
    service = BeforeOrderService()
    assert service.cancellation_fee(order) == 75.0
    assert service.loyalty_discount(customer) == 0.25


def test_before_cancellation_fee_and_loyalty_discount_disagree_at_the_spend_boundary() -> None:
    customer = BeforeCustomer(tier="bronze", lifetime_spend=1000, years_as_member=0)
    order = BeforeOrder(amount=200, customer=customer)
    service = BeforeOrderService()
    assert service.cancellation_fee(order) == 175.0  # 12.5% discount applied
    assert service.loyalty_discount(customer) == 0.0  # same customer, no discount at all


def test_after_cancellation_fee_asks_the_customer_for_its_own_discount() -> None:
    customer = AfterCustomer(tier="gold", lifetime_spend=500, years_as_member=1)
    order = AfterOrder(amount=100, customer=customer)
    service = AfterOrderService()
    assert service.cancellation_fee(order) == 75.0
    assert service.loyalty_discount(customer) == 0.25


def test_after_cancellation_fee_and_loyalty_discount_agree_at_the_spend_boundary() -> None:
    customer = AfterCustomer(tier="bronze", lifetime_spend=1000, years_as_member=0)
    order = AfterOrder(amount=200, customer=customer)
    service = AfterOrderService()
    assert service.cancellation_fee(order) == 175.0
    assert service.loyalty_discount(customer) == 0.125
