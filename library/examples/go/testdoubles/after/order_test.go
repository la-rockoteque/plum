package after

import (
	"fmt"
	"strings"
	"testing"
)

// nullAuditLogger is a dummy: it satisfies the field. If a test ever asserted on this,
// it wouldn't be a dummy anymore.
type nullAuditLogger struct{}

func (nullAuditLogger) Log(message string) error {
	panic("dummy should never be called")
}

// inMemoryOrderRepository is a fake: real find/save behaviour, no external system.
type inMemoryOrderRepository struct {
	orders map[string]*Order
}

func newInMemoryOrderRepository(orders ...*Order) *inMemoryOrderRepository {
	byID := make(map[string]*Order, len(orders))
	for _, order := range orders {
		byID[order.ID] = order
	}
	return &inMemoryOrderRepository{orders: byID}
}

func (r *inMemoryOrderRepository) FindByID(orderID string) (*Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, fmt.Errorf("unknown order %s", orderID)
	}
	return order, nil
}

func (r *inMemoryOrderRepository) Save(order *Order) error {
	r.orders[order.ID] = order
	return nil
}

// stubPaymentGateway is a stub: a canned response. Nothing is recorded, nothing is verified.
type stubPaymentGateway struct{}

func (stubPaymentGateway) Charge(orderID string, amount float64) error {
	return nil
}

// mockPaymentGateway is a mock: a hand-rolled expectation. The wrong call fails
// immediately; the right one is recorded.
type mockPaymentGateway struct {
	expectedOrderID string
	expectedAmount  float64
	called          bool
}

func (m *mockPaymentGateway) Charge(orderID string, amount float64) error {
	if orderID != m.expectedOrderID || amount != m.expectedAmount {
		return fmt.Errorf("unexpected charge: %s %v", orderID, amount)
	}
	m.called = true
	return nil
}

// spyMailer is a spy: it records what was sent so the test can assert afterwards
// (state verification).
type spyMailer struct {
	sent []string
}

func (s *spyMailer) Send(to, message string) error {
	s.sent = append(s.sent, to+"|"+message)
	return nil
}

func anOrder(fee float64) *Order {
	return NewOrder("order-1", "ada@example.com", fee)
}

func TestAfter_DummyAuditLoggerIsPassedButNeverCalled(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(5.0))
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{}, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute("order-1"); err != nil {
		t.Fatal(err) // would fail if the dummy were ever invoked
	}
}

func TestAfter_StubGatewayReturnsACannedChargeResult(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(5.0))
	mailer := &spyMailer{}
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{}, Mailer: mailer, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute("order-1"); err != nil {
		t.Fatal(err)
	}
	// The stub's canned response is enough to let the use case reach the mailer.
	if len(mailer.sent) == 0 {
		t.Fatal("expected the mailer to have been reached")
	}
}

func TestAfter_SpyMailerRecordsTheMessageItSent(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(5.0))
	mailer := &spyMailer{}
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{}, Mailer: mailer, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute("order-1"); err != nil {
		t.Fatal(err)
	}
	want := []string{"ada@example.com|Your order order-1 was cancelled"}
	if len(mailer.sent) != 1 || mailer.sent[0] != want[0] {
		t.Fatalf("got %v, want %v", mailer.sent, want)
	}
}

func TestAfter_MockGatewayAcceptsTheExpectedCharge(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(5.0))
	gateway := &mockPaymentGateway{expectedOrderID: "order-1", expectedAmount: 5.0}
	useCase := CancelOrder{Orders: orders, Gateway: gateway, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute("order-1"); err != nil {
		t.Fatal(err)
	}
	if !gateway.called {
		t.Fatal("expected the mock to have been called")
	}
}

func TestAfter_MockGatewayRejectsAnUnexpectedAmount(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(999.0))
	gateway := &mockPaymentGateway{expectedOrderID: "order-1", expectedAmount: 5.0}
	useCase := CancelOrder{Orders: orders, Gateway: gateway, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	err := useCase.Execute("order-1")
	if err == nil || !strings.Contains(err.Error(), "unexpected charge") {
		t.Fatalf("got error %v, want unexpected charge", err)
	}
}

func TestAfter_FakeRepositorySavesTheCancelledOrder(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(5.0))
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{}, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute("order-1"); err != nil {
		t.Fatal(err)
	}
	// Real behaviour: a later read reflects what an earlier write saved.
	saved, err := orders.FindByID("order-1")
	if err != nil {
		t.Fatal(err)
	}
	if saved.Status != "cancelled" {
		t.Fatalf("got status %q, want cancelled", saved.Status)
	}
}
