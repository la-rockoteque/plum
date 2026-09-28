import pytest

from law_of_demeter.after import Address as AfterAddress
from law_of_demeter.after import CancellationPolicy as AfterCancellationPolicy
from law_of_demeter.after import Card as AfterCard
from law_of_demeter.after import Country as AfterCountry
from law_of_demeter.after import Customer as AfterCustomer
from law_of_demeter.after import Order as AfterOrder
from law_of_demeter.after import Wallet as AfterWallet
from law_of_demeter.before import Address as BeforeAddress
from law_of_demeter.before import CancellationPolicy as BeforeCancellationPolicy
from law_of_demeter.before import Card as BeforeCard
from law_of_demeter.before import Country as BeforeCountry
from law_of_demeter.before import Customer as BeforeCustomer
from law_of_demeter.before import Order as BeforeOrder
from law_of_demeter.before import Wallet as BeforeWallet


def test_before_shipping_and_refund_decisions_walk_the_customers_address_and_wallet_directly() -> None:
    policy = BeforeCancellationPolicy()

    domestic = BeforeOrder(
        customer=BeforeCustomer(
            address=BeforeAddress(country=BeforeCountry(code="US")),
            wallet=BeforeWallet(card=BeforeCard(expired=False)),
        )
    )
    assert policy.ships_domestically(domestic) is True
    assert policy.can_auto_refund(domestic) is True

    foreign = BeforeOrder(
        customer=BeforeCustomer(
            address=BeforeAddress(country=BeforeCountry(code="CA")),
            wallet=BeforeWallet(card=BeforeCard(expired=True)),
        )
    )
    assert policy.ships_domestically(foreign) is False
    assert policy.can_auto_refund(foreign) is False


def test_before_a_pickup_point_address_without_a_country_breaks_the_shipping_check() -> None:
    policy = BeforeCancellationPolicy()
    order = BeforeOrder(
        customer=BeforeCustomer(
            address=BeforeAddress(country=None),
            wallet=BeforeWallet(card=BeforeCard(expired=False)),
        )
    )
    with pytest.raises(AttributeError):
        policy.ships_domestically(order)


def test_after_order_asks_its_customer_who_asks_its_own_collaborators_for_the_same_decisions() -> None:
    policy = AfterCancellationPolicy()

    domestic = AfterOrder(
        customer=AfterCustomer(
            address=AfterAddress(country=AfterCountry(code="US")),
            wallet=AfterWallet(card=AfterCard(expired=False)),
        )
    )
    assert policy.ships_domestically(domestic) is True
    assert policy.can_auto_refund(domestic) is True

    foreign = AfterOrder(
        customer=AfterCustomer(
            address=AfterAddress(country=AfterCountry(code="CA")),
            wallet=AfterWallet(card=AfterCard(expired=True)),
        )
    )
    assert policy.ships_domestically(foreign) is False
    assert policy.can_auto_refund(foreign) is False


def test_after_a_pickup_point_address_without_a_country_no_longer_breaks_the_shipping_check() -> None:
    policy = AfterCancellationPolicy()
    order = AfterOrder(
        customer=AfterCustomer(
            address=AfterAddress(country=None),
            wallet=AfterWallet(card=AfterCard(expired=False)),
        )
    )
    assert policy.ships_domestically(order) is False
    assert policy.can_auto_refund(order) is True
