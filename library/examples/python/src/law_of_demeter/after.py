"""Each object only talks to its own data or its direct collaborator. Address answers
"domestic?" for itself whether it still holds a plain country or, after the region migration,
a Region one hop further out -- so the callers below never have to learn the new shape."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class Country:
    code: str


@dataclass
class Region:
    country: Country

    def is_domestic(self) -> bool:
        return self.country.code == "US"


@dataclass
class Address:
    country: Optional[Country]
    region: Optional[Region]

    def is_domestic(self) -> bool:
        if self.region is not None:
            return self.region.is_domestic()
        if self.country is not None:
            return self.country.code == "US"
        return False  # a pickup point has no single country either


@dataclass
class Customer:
    address: Address

    def can_auto_refund(self) -> bool:
        return self.address.is_domestic()

    def needs_customs_form(self) -> bool:
        return not self.address.is_domestic()


@dataclass
class Order:
    customer: Customer

    def can_auto_refund(self) -> bool:
        return self.customer.can_auto_refund()

    def needs_customs_form(self) -> bool:
        return self.customer.needs_customs_form()


class CancellationPolicy:
    def can_auto_refund(self, order: Order) -> bool:
        return order.can_auto_refund()


class ReturnLabelPrinter:
    def needs_customs_form(self, order: Order) -> bool:
        return order.needs_customs_form()
