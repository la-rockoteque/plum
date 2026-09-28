"""Cancellation fees and refund descriptions vary by order type."""
from dataclasses import dataclass

STANDARD = "standard"
EXPRESS = "express"
CUSTOM_MADE = "custom-made"
SUBSCRIPTION = "subscription"

EXPRESS_FLAT_FEE = 15.0
CUSTOM_MADE_FEE_RATE = 0.5


@dataclass
class Order:
    type: str
    amount: float
    pending: bool = True
    months_elapsed: int = 0
    total_months: int = 1
