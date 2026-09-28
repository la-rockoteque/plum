package application

import (
	"errors"
	"strings"
)

type Notifier interface {
	Send(message string) error
}

var ErrNameRequired = errors.New("name is required")

type WelcomeUser struct {
	notifier Notifier
}

// The application owns its contract and receives an implementation.
func NewWelcomeUser(notifier Notifier) WelcomeUser {
	return WelcomeUser{notifier: notifier}
}

func (w WelcomeUser) Execute(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrNameRequired
	}
	return w.notifier.Send("Welcome, " + name + "!")
}
