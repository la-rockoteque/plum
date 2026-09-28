from dependency_injection_example.infrastructure import ConsoleNotifier


class WelcomeUser:
    def __init__(self) -> None:
        # The use case chooses, constructs, and depends on a concrete adapter.
        self.notifier = ConsoleNotifier()

    def execute(self, name: str) -> None:
        name = name.strip()
        if not name:
            raise ValueError("Name is required")
        self.notifier.send(f"Welcome, {name}!")
