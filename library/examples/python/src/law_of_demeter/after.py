"""Each object only talks to its own data or its direct collaborator; the caller asks Order
one question at a time. A pickup point's missing country is absorbed where it lives, in
Address, instead of blowing up three hops away."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Country:
    code: str


@dataclass
class Address:
    country: Optional[Country]  # None for a pickup point

    def is_domestic(self) -> bool:
        return self.country is not None and self.country.code == "US"


@dataclass
class Card:
    expired: bool

    def is_expired(self) -> bool:
        return self.expired


@dataclass
class Wallet:
    card: Card

    def has_valid_card(self) -> bool:
        return not self.card.is_expired()


@dataclass
class Customer:
    address: Address
    wallet: Wallet

    def ships_domestically(self) -> bool:
        return self.address.is_domestic()

    def can_auto_refund(self) -> bool:
        return self.wallet.has_valid_card()


@dataclass
class Order:
    customer: Customer

    def returns_ship_domestically(self) -> bool:
        return self.customer.ships_domestically()

    def can_auto_refund(self) -> bool:
        return self.customer.can_auto_refund()


class CancellationPolicy:
    def ships_domestically(self, order: Order) -> bool:
        return order.returns_ship_domestically()

    def can_auto_refund(self, order: Order) -> bool:
        return order.can_auto_refund()
