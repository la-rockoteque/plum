import argparse

from dependency_injection_example.application import WelcomeUser
from dependency_injection_example.before import WelcomeUser as BeforeWelcomeUser
from dependency_injection_example.infrastructure import ConsoleNotifier, RecordingNotifier
from dependency_injection_example.injection_only import WelcomeUser as InjectedWelcomeUser


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare injection and inversion")
    parser.add_argument("stage", choices=["before", "injection", "console", "recording"])
    stage = parser.parse_args().stage
    # Composition root: construction belongs at the edge of the application.
    if stage == "before":
        BeforeWelcomeUser().execute("Ada")
    elif stage == "injection":
        InjectedWelcomeUser(ConsoleNotifier()).execute("Ada")
    elif stage == "console":
        WelcomeUser(ConsoleNotifier()).execute("Ada")
    else:
        notifier = RecordingNotifier()
        WelcomeUser(notifier).execute("Ada")
        print(f"Recorded: {notifier.messages[0]}")


if __name__ == "__main__":
    main()
