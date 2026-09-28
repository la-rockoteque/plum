"""Teaching artifact: the refund and customs decisions each walk straight through the
customer's address to read its country -- a train wreck that breaks not by crashing, but by
silently giving the wrong answer the day the country moves one hop further out."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Country:
    code: str


@dataclass
class Region:
    """Introduced later: countries are grouped under a customs region."""

    country: Country


@dataclass
class Address:
    # Exactly one of these is set: `country` for an address created before the region
    # migration, `region` for one created after it. Neither caller below knows about `region`.
    country: Optional[Country]
    region: Optional[Region]


@dataclass
class Customer:
    address: Address


@dataclass
class Order:
    customer: Customer


class CancellationPolicy:
    def can_auto_refund(self, order: Order) -> bool:
        # Train wreck: order -> customer -> address -> country -> code.
        address = order.customer.address
        if address.country is None:
            return False  # play it safe: no auto-refund if we can't read a country
        return address.country.code == "US"


class ReturnLabelPrinter:
    def needs_customs_form(self, order: Order) -> bool:
        # Train wreck: order -> customer -> address -> country -> code.
        address = order.customer.address
        if address.country is None:
            return True  # play it safe: assume a customs form is needed
        return address.country.code != "US"
