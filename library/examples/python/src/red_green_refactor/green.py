class Order:
    """Minimal fix: a bare status-string comparison, right where cancel() decides."""

    def __init__(self, status: str = "pending") -> None:
        self.status = status

    def cancel(self) -> None:
        if self.status == "shipped":
            raise ValueError("a shipped order can't be cancelled")
        self.status = "cancelled"
