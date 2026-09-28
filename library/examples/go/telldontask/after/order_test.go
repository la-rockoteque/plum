package after

import "testing"

type fixedClock struct{ ms int64 }

func (c fixedClock) NowMs() int64 { return c.ms }

type canceller interface {
	Cancel(order *Order, clock Clock) error
}

func TestAfter_ApiHandlerNightlyJobAndAdminToolAllCancelTheSameWay(t *testing.T) {
	clock := fixedClock{1000}
	cases := []struct {
		handler canceller
		order   *Order
	}{
		{ApiCancelHandler{}, NewOrder(1, Pending, 5000, nil)},
		{NightlyCancelJob{}, NewOrder(2, Pending, 5000, nil)},
		{AdminCancelTool{}, NewOrder(3, Pending, 5000, nil)},
	}
	for _, c := range cases {
		if err := c.handler.Cancel(c.order, clock); err != nil {
			t.Fatalf("want cancellation to succeed, got %v", err)
		}
		if c.order.Status() != Cancelled {
			t.Fatal("want cancelled")
		}
		if c.order.CancelledAtMs() == nil || *c.order.CancelledAtMs() != 1000 {
			t.Fatal("want cancelled at 1000")
		}
		if c.order.RefundDueCents() != 5000 {
			t.Fatal("want a full refund")
		}
	}
}

func TestAfter_CancellingAnAlreadyShippedOrderIsRejected(t *testing.T) {
	clock := fixedClock{1000}
	shippedAt := int64(500)
	handlers := []canceller{ApiCancelHandler{}, NightlyCancelJob{}, AdminCancelTool{}}
	for _, handler := range handlers {
		order := NewOrder(4, Shipped, 5000, &shippedAt)
		if err := handler.Cancel(order, clock); err == nil {
			t.Fatal("want cancelling a shipped order to be rejected")
		}
		if order.Status() != Shipped {
			t.Fatal("want status unchanged")
		}
		if order.CancelledAtMs() != nil {
			t.Fatal("want cancelledAtMs unset")
		}
		if order.RefundDueCents() != 0 {
			t.Fatal("want no refund")
		}
	}
}
