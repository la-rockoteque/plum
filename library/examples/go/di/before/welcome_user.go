package before

import (
	"errors"
	"strings"

	"example.com/repository-example/di/infrastructure"
)

type WelcomeUser struct {
	notifier infrastructure.ConsoleNotifier
}

func NewWelcomeUser() WelcomeUser {
	// The use case chooses, constructs, and depends on a concrete adapter.
	return WelcomeUser{notifier: infrastructure.ConsoleNotifier{}}
}

func (w WelcomeUser) Execute(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("name is required")
	}
	return w.notifier.Send("Welcome, " + name + "!")
}
