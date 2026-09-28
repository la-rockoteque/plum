from typing import Protocol


class Notifier(Protocol):
    def send(self, message: str) -> None: ...


class WelcomeUser:
    """The application owns its contract and receives an implementation."""

    def __init__(self, notifier: Notifier) -> None:
        self.notifier = notifier

    def execute(self, name: str) -> None:
        name = name.strip()
        if not name:
            raise ValueError("Name is required")
        self.notifier.send(f"Welcome, {name}!")
