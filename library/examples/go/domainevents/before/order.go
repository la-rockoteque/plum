// Package before: Cancel calls three unrelated services inline — the aggregate imports all of them.
package before

import "errors"

var ErrOrderAlreadyCancelled = errors.New("order is already cancelled")

type InventoryService interface {
	Release(orderID int) error
}

type Mailer interface {
	SendCancellationEmail(orderID int) error
}

type LoyaltyLedger interface {
	RecordCancellation(orderID int) error
}

// Order depends on three collaborators just to change its own status.
type Order struct {
	ID        int
	Status    string
	inventory InventoryService
	mailer    Mailer
	loyalty   LoyaltyLedger
}

func NewOrder(id int, inventory InventoryService, mailer Mailer, loyalty LoyaltyLedger) *Order {
	return &Order{ID: id, Status: "pending", inventory: inventory, mailer: mailer, loyalty: loyalty}
}

func (o *Order) Cancel(reason string) error {
	if o.Status == "cancelled" {
		return ErrOrderAlreadyCancelled
	}
	// If any of these three calls fails, the ones before it already ran
	// and the ones after it never will — and status is set only at the end.
	if err := o.inventory.Release(o.ID); err != nil {
		return err
	}
	if err := o.mailer.SendCancellationEmail(o.ID); err != nil {
		return err
	}
	if err := o.loyalty.RecordCancellation(o.ID); err != nil {
		return err
	}
	o.Status = "cancelled"
	return nil
}
