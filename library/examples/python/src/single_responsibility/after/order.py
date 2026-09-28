from dataclasses import dataclass


@dataclass
class Order:
    id: str
    customer_name: str
    customer_email: str
    status: str = "pending"
