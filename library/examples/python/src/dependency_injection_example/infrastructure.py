class ConsoleNotifier:
    def send(self, message: str) -> None:
        print(message)


class RecordingNotifier:
    def __init__(self) -> None:
        self.messages: list[str] = []

    def send(self, message: str) -> None:
        self.messages.append(message)
