package before

import "testing"

type fixedClock struct{ ms int64 }

func (c fixedClock) NowMs() int64 { return c.ms }

func TestBefore_ApiHandlerCancelsAPendingOrderAndSetsTheRefund(t *testing.T) {
	order := &Order{ID: 1, Status: Pending, AmountPaidCents: 5000}
	ApiCancelHandler{}.Cancel(order, fixedClock{1000})
	if order.Status != Cancelled {
		t.Fatal("want cancelled")
	}
	if order.CancelledAtMs == nil || *order.CancelledAtMs != 1000 {
		t.Fatal("want cancelled at 1000")
	}
	if order.RefundDueCents != 5000 {
		t.Fatal("want a full refund")
	}
}

func TestBefore_NightlyJobCancelsAStaleOrderButLeavesTheRefundUnset(t *testing.T) {
	order := &Order{ID: 2, Status: Pending, AmountPaidCents: 5000}
	NightlyCancelJob{}.Cancel(order, fixedClock{1000})
	if order.Status != Cancelled {
		t.Fatal("want cancelled")
	}
	if order.RefundDueCents != 0 {
		t.Fatal("bug: the payment is gone, no refund recorded")
	}
}

func TestBefore_AdminToolCancelsAnAlreadyShippedOrder(t *testing.T) {
	shippedAt := int64(500)
	order := &Order{ID: 3, Status: Shipped, AmountPaidCents: 5000, ShippedAtMs: &shippedAt}
	AdminCancelTool{}.Cancel(order, fixedClock{1000})
	if order.Status != Cancelled {
		t.Fatal("bug: a shipped order should stay shipped")
	}
}
