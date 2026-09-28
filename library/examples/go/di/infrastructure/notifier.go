package infrastructure

import "fmt"

type ConsoleNotifier struct{}

func (ConsoleNotifier) Send(message string) error {
	_, err := fmt.Println(message)
	return err
}

type RecordingNotifier struct {
	Messages []string
}

func (n *RecordingNotifier) Send(message string) error {
	n.Messages = append(n.Messages, message)
	return nil
}
