// Package behaviour_test runs one shared test body against both green and refactor: they must behave identically.
// It lives in its own package (not inside green or refactor) purely to import both without a cycle.
package behaviour_test

import (
	"testing"

	"example.com/repository-example/redgreenrefactor/green"
	"example.com/repository-example/redgreenrefactor/refactor"
)

type stage struct {
	name  string
	build func(status string) (cancel func() error, getStatus func() string)
}

var stages = []stage{
	{
		name: "green",
		build: func(status string) (func() error, func() string) {
			o := green.NewOrder(status)
			return o.Cancel, func() string { return o.Status }
		},
	},
	{
		name: "refactor",
		build: func(status string) (func() error, func() string) {
			o := refactor.NewOrder(status)
			return o.Cancel, func() string { return o.Status }
		},
	},
}

func TestGreenAndRefactor_CancellingAPendingOrderSucceeds(t *testing.T) {
	for _, s := range stages {
		t.Run(s.name, func(t *testing.T) {
			cancel, status := s.build("pending")
			if err := cancel(); err != nil {
				t.Fatal(err)
			}
			if status() != "cancelled" {
				t.Fatalf("got status %q, want cancelled", status())
			}
		})
	}
}

func TestGreenAndRefactor_CancellingAShippedOrderIsRejected(t *testing.T) {
	for _, s := range stages {
		t.Run(s.name, func(t *testing.T) {
			cancel, status := s.build("shipped")
			if err := cancel(); err == nil {
				t.Fatal("expected an error cancelling a shipped order")
			}
			if status() != "shipped" {
				t.Fatalf("got status %q, want shipped", status())
			}
		})
	}
}
