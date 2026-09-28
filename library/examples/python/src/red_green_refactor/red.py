class Order:
    """No rule yet: any status can be cancelled."""

    def __init__(self, status: str = "pending") -> None:
        self.status = status

    def cancel(self) -> None:
        self.status = "cancelled"
