package main

import (
	"fmt"
	"os"

	"example.com/repository-example/di/application"
	"example.com/repository-example/di/before"
	"example.com/repository-example/di/infrastructure"
	"example.com/repository-example/di/injectiononly"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: go run ./cmd/di-demo before|injection|console|recording")
	}
	// Composition root: construction belongs at the edge of the application.
	switch args[0] {
	case "before":
		return before.NewWelcomeUser().Execute("Ada")
	case "injection":
		return injectiononly.NewWelcomeUser(infrastructure.ConsoleNotifier{}).Execute("Ada")
	case "console":
		return application.NewWelcomeUser(infrastructure.ConsoleNotifier{}).Execute("Ada")
	case "recording":
		notifier := &infrastructure.RecordingNotifier{}
		if err := application.NewWelcomeUser(notifier).Execute("Ada"); err != nil {
			return err
		}
		fmt.Printf("Recorded: %s\n", notifier.Messages[0])
		return nil
	default:
		return fmt.Errorf("usage: go run ./cmd/di-demo before|injection|console|recording")
	}
}
