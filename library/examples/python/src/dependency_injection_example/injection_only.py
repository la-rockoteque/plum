from dependency_injection_example.infrastructure import ConsoleNotifier


class WelcomeUser:
    def __init__(self, notifier: ConsoleNotifier) -> None:
        # Injection changes who constructs it, but this contract is still concrete.
        self.notifier = notifier

    def execute(self, name: str) -> None:
        name = name.strip()
        if not name:
            raise ValueError("Name is required")
        self.notifier.send(f"Welcome, {name}!")
