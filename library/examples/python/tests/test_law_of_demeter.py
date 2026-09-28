from law_of_demeter.after import Address as AfterAddress
from law_of_demeter.after import CancellationPolicy as AfterCancellationPolicy
from law_of_demeter.after import Country as AfterCountry
from law_of_demeter.after import Customer as AfterCustomer
from law_of_demeter.after import Order as AfterOrder
from law_of_demeter.after import Region as AfterRegion
from law_of_demeter.after import ReturnLabelPrinter as AfterReturnLabelPrinter
from law_of_demeter.before import Address as BeforeAddress
from law_of_demeter.before import CancellationPolicy as BeforeCancellationPolicy
from law_of_demeter.before import Country as BeforeCountry
from law_of_demeter.before import Customer as BeforeCustomer
from law_of_demeter.before import Order as BeforeOrder
from law_of_demeter.before import Region as BeforeRegion
from law_of_demeter.before import ReturnLabelPrinter as BeforeReturnLabelPrinter


def test_before_refund_and_customs_decisions_walk_the_customers_address_directly_for_ordinary_addresses() -> None:
    cancellation = BeforeCancellationPolicy()
    labels = BeforeReturnLabelPrinter()

    domestic = BeforeOrder(customer=BeforeCustomer(address=BeforeAddress(country=BeforeCountry("US"), region=None)))
    assert cancellation.can_auto_refund(domestic) is True
    assert labels.needs_customs_form(domestic) is False

    foreign = BeforeOrder(customer=BeforeCustomer(address=BeforeAddress(country=BeforeCountry("CA"), region=None)))
    assert cancellation.can_auto_refund(foreign) is False
    assert labels.needs_customs_form(foreign) is True


def test_before_a_region_migrated_domestic_address_is_wrongly_treated_as_non_domestic_by_both_distant_callers() -> None:
    cancellation = BeforeCancellationPolicy()
    labels = BeforeReturnLabelPrinter()

    migrated_domestic = BeforeOrder(
        customer=BeforeCustomer(
            address=BeforeAddress(country=None, region=BeforeRegion(country=BeforeCountry("US")))
        )
    )
    # Both callers still only know how to read `address.country`; neither has been taught
    # about `region`, so both get the same, wrong, conservative answer.
    assert cancellation.can_auto_refund(migrated_domestic) is False
    assert labels.needs_customs_form(migrated_domestic) is True


def test_after_order_asks_its_customer_for_the_same_refund_and_customs_decisions() -> None:
    cancellation = AfterCancellationPolicy()
    labels = AfterReturnLabelPrinter()

    domestic = AfterOrder(customer=AfterCustomer(address=AfterAddress(country=AfterCountry("US"), region=None)))
    assert cancellation.can_auto_refund(domestic) is True
    assert labels.needs_customs_form(domestic) is False

    foreign = AfterOrder(customer=AfterCustomer(address=AfterAddress(country=AfterCountry("CA"), region=None)))
    assert cancellation.can_auto_refund(foreign) is False
    assert labels.needs_customs_form(foreign) is True


def test_after_the_same_caller_code_answers_correctly_once_address_owns_the_region_migrated_shape() -> None:
    cancellation = AfterCancellationPolicy()
    labels = AfterReturnLabelPrinter()

    migrated_domestic = AfterOrder(
        customer=AfterCustomer(address=AfterAddress(country=None, region=AfterRegion(country=AfterCountry("US"))))
    )
    assert cancellation.can_auto_refund(migrated_domestic) is True
    assert labels.needs_customs_form(migrated_domestic) is False


def test_after_a_pickup_point_address_with_no_country_or_region_is_treated_as_non_domestic_without_crashing() -> None:
    cancellation = AfterCancellationPolicy()
    labels = AfterReturnLabelPrinter()

    pickup_point = AfterOrder(customer=AfterCustomer(address=AfterAddress(country=None, region=None)))
    assert cancellation.can_auto_refund(pickup_point) is False
    assert labels.needs_customs_form(pickup_point) is True
