package injectiononly

import (
	"errors"
	"strings"

	"example.com/repository-example/di/infrastructure"
)

type WelcomeUser struct {
	notifier infrastructure.ConsoleNotifier
}

func NewWelcomeUser(notifier infrastructure.ConsoleNotifier) WelcomeUser {
	// Injection changes who constructs it, but this contract is still concrete.
	return WelcomeUser{notifier: notifier}
}

func (w WelcomeUser) Execute(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("name is required")
	}
	return w.notifier.Send("Welcome, " + name + "!")
}
