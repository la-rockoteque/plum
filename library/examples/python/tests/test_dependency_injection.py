import pytest

from dependency_injection_example.application import WelcomeUser
from dependency_injection_example.before import WelcomeUser as BeforeWelcomeUser
from dependency_injection_example.infrastructure import ConsoleNotifier, RecordingNotifier
from dependency_injection_example.injection_only import WelcomeUser as InjectedWelcomeUser


def test_injected_recording_notifier_receives_the_message() -> None:
    notifier = RecordingNotifier()
    WelcomeUser(notifier).execute("  Ada  ")
    assert notifier.messages == ["Welcome, Ada!"]


def test_invalid_name_does_not_notify() -> None:
    notifier = RecordingNotifier()
    with pytest.raises(ValueError, match="Name is required"):
        WelcomeUser(notifier).execute(" \t ")
    assert notifier.messages == []


def test_notifier_failure_reaches_the_caller() -> None:
    class FailingNotifier:
        def send(self, message: str) -> None:
            raise RuntimeError("Delivery failed")

    with pytest.raises(RuntimeError, match="Delivery failed"):
        WelcomeUser(FailingNotifier()).execute("Ada")


def test_console_stages_preserve_behavior(capsys: pytest.CaptureFixture[str]) -> None:
    BeforeWelcomeUser().execute(" Ada ")
    InjectedWelcomeUser(ConsoleNotifier()).execute(" Ada ")
    WelcomeUser(ConsoleNotifier()).execute(" Ada ")
    assert capsys.readouterr().out == "Welcome, Ada!\n" * 3
