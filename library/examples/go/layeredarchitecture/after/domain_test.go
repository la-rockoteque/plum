package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/layeredarchitecture/after"
)

func TestAfter_TheDomainRuleRejectsAShippedOrderWithNoRequestOrDatabase(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Shipped}
	if err := order.Cancel(); !errors.Is(err, after.ErrOrderCannotBeCancelled) {
		t.Fatalf("got %v", err)
	}
}

func TestAfter_TheDomainRuleRejectsACancelledOrderWithNoRequestOrDatabase(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Cancelled}
	if err := order.Cancel(); !errors.Is(err, after.ErrOrderCannotBeCancelled) {
		t.Fatalf("got %v", err)
	}
}

func TestAfter_TheDomainRuleCancelsAPendingOrder(t *testing.T) {
	order := after.Order{ID: 1, Status: after.Pending}
	if err := order.Cancel(); err != nil || order.Status != after.Cancelled {
		t.Fatalf("got status %s, err %v", order.Status, err)
	}
}
