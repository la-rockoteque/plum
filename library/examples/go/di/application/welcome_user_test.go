package application_test

import (
	"errors"
	"testing"

	"example.com/repository-example/di/application"
	"example.com/repository-example/di/infrastructure"
)

func TestInjectedRecorderReceivesMessage(t *testing.T) {
	notifier := &infrastructure.RecordingNotifier{}
	if err := application.NewWelcomeUser(notifier).Execute("  Ada  "); err != nil {
		t.Fatal(err)
	}
	if len(notifier.Messages) != 1 || notifier.Messages[0] != "Welcome, Ada!" {
		t.Fatalf("unexpected messages: %v", notifier.Messages)
	}
}

func TestInvalidNameDoesNotNotify(t *testing.T) {
	notifier := &infrastructure.RecordingNotifier{}
	err := application.NewWelcomeUser(notifier).Execute(" \t ")
	if !errors.Is(err, application.ErrNameRequired) {
		t.Fatalf("got %v, want name required", err)
	}
	if len(notifier.Messages) != 0 {
		t.Fatalf("invalid name sent messages: %v", notifier.Messages)
	}
}

type failingNotifier struct{ err error }

func (n failingNotifier) Send(string) error { return n.err }

func TestNotifierFailureReachesCaller(t *testing.T) {
	failure := errors.New("delivery failed")
	err := application.NewWelcomeUser(failingNotifier{failure}).Execute("Ada")
	if !errors.Is(err, failure) {
		t.Fatalf("delivery failure lost: %v", err)
	}
}
