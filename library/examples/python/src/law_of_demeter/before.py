"""Teaching artifact: cancelling an order walks straight through the customer's address and
wallet to decide how to ship the return and whether to auto-refund — a train wreck that
breaks the moment one address turns out not to have a country."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Country:
    code: str


@dataclass
class Address:
    country: Optional[Country]  # None for a pickup point — no single country's customs apply


@dataclass
class Card:
    expired: bool


@dataclass
class Wallet:
    card: Card


@dataclass
class Customer:
    address: Address
    wallet: Wallet


@dataclass
class Order:
    customer: Customer


class CancellationPolicy:
    def ships_domestically(self, order: Order) -> bool:
        # Train wreck: order -> customer -> address -> country -> code.
        return order.customer.address.country.code == "US"

    def can_auto_refund(self, order: Order) -> bool:
        # Train wreck: order -> customer -> wallet -> card -> expired.
        return not order.customer.wallet.card.expired
