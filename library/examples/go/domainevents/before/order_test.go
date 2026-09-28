package before_test

import (
	"errors"
	"testing"

	"example.com/repository-example/domainevents/before"
)

var errMailerUnavailable = errors.New("mailer unavailable")

type fakeInventoryService struct {
	released []int
}

func (f *fakeInventoryService) Release(orderID int) error {
	f.released = append(f.released, orderID)
	return nil
}

type fakeMailer struct {
	sent []int
}

func (f *fakeMailer) SendCancellationEmail(orderID int) error {
	f.sent = append(f.sent, orderID)
	return nil
}

type failingMailer struct{}

func (failingMailer) SendCancellationEmail(orderID int) error {
	return errMailerUnavailable
}

type fakeLoyaltyLedger struct {
	recorded []int
}

func (f *fakeLoyaltyLedger) RecordCancellation(orderID int) error {
	f.recorded = append(f.recorded, orderID)
	return nil
}

func TestBefore_CancellingCallsTheInventoryMailerAndLoyaltyCollaboratorsDirectly(t *testing.T) {
	inventory := &fakeInventoryService{}
	mailer := &fakeMailer{}
	loyalty := &fakeLoyaltyLedger{}
	order := before.NewOrder(1, inventory, mailer, loyalty)

	if err := order.Cancel("customer request"); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}
	if got := inventory.released; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got released %v, want [1]", got)
	}
	if got := mailer.sent; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got sent %v, want [1]", got)
	}
	if got := loyalty.recorded; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got recorded %v, want [1]", got)
	}
	if order.Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", order.Status)
	}
}

func TestBefore_AFailingMailerLeavesInventoryReleasedButTheOrderNotCancelled(t *testing.T) {
	inventory := &fakeInventoryService{}
	loyalty := &fakeLoyaltyLedger{}
	order := before.NewOrder(1, inventory, failingMailer{}, loyalty)

	err := order.Cancel("customer request")
	if !errors.Is(err, errMailerUnavailable) {
		t.Fatalf("got %v, want mailer unavailable", err)
	}
	if got := inventory.released; len(got) != 1 || got[0] != 1 {
		t.Fatalf("got released %v, want [1] (already ran)", got)
	}
	if len(loyalty.recorded) != 0 {
		t.Fatalf("got recorded %v, want none (never reached)", loyalty.recorded)
	}
	if order.Status != "pending" {
		t.Fatalf("got status %q, want pending (inconsistent: inventory released but order not cancelled)", order.Status)
	}
}
