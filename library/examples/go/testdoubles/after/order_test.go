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

// spyAuditLogger is a spy: it records the decline message so the test can assert
// afterwards (state verification). The audit logger becomes a real collaborator once a
// charge is declined.
type spyAuditLogger struct {
	messages []string
}

func (s *spyAuditLogger) Log(message string) error {
	s.messages = append(s.messages, message)
	return nil
}

// inMemoryOrderRepository is a fake: real get/save behaviour, no external system. Its
// map stores Order by value, so every read and write already copies — mutating what Get
// returns never leaks into storage until Save is called.
type inMemoryOrderRepository struct {
	orders map[int]Order
}

func newInMemoryOrderRepository(orders ...*Order) *inMemoryOrderRepository {
	byID := make(map[int]Order, len(orders))
	for _, order := range orders {
		byID[order.ID] = *order
	}
	return &inMemoryOrderRepository{orders: byID}
}

func (r *inMemoryOrderRepository) Get(orderID int) (*Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, fmt.Errorf("unknown order %d", orderID)
	}
	return &order, nil
}

func (r *inMemoryOrderRepository) Save(order *Order) error {
	r.orders[order.ID] = *order
	return nil
}

// stubPaymentGateway is a stub: a canned response. Nothing is recorded, nothing is verified.
type stubPaymentGateway struct {
	result ChargeResult
}

func (s stubPaymentGateway) Charge(orderID int, amountMinor int) (ChargeResult, error) {
	return s.result, nil
}

// mockPaymentGateway is a mock: a hand-rolled expectation. The wrong call fails
// immediately; the right one is recorded.
type mockPaymentGateway struct {
	expectedOrderID     int
	expectedAmountMinor int
	called              bool
}

func (m *mockPaymentGateway) Charge(orderID int, amountMinor int) (ChargeResult, error) {
	if orderID != m.expectedOrderID || amountMinor != m.expectedAmountMinor {
		return "", fmt.Errorf("unexpected charge: %d %d", orderID, amountMinor)
	}
	m.called = true
	return ChargeApproved, nil
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

func anOrder(amountMinor int) *Order {
	return NewOrder(1, "ada@example.com", amountMinor)
}

func TestAfter_DummyAuditLoggerIsPassedButNeverCalled(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(500))
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{result: ChargeApproved}, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute(1); err != nil {
		t.Fatal(err) // would panic if the dummy were ever invoked
	}
}

func TestAfter_StubGatewayReturnsACannedDeclineAndTheOrderIsNotCancelled(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(500))
	audit := &spyAuditLogger{}
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{result: ChargeDeclined}, Mailer: &spyMailer{}, AuditLogger: audit}
	if err := useCase.Execute(1); err != nil {
		t.Fatal(err)
	}
	saved, err := orders.Get(1)
	if err != nil {
		t.Fatal(err)
	}
	// The stub's canned decline is enough to keep the order out of the cancelled state...
	if saved.Status != StatusPending {
		t.Fatalf("got status %q, want pending", saved.Status)
	}
	// ...and it drove a real call to the audit logger, which is no longer dead code.
	want := []string{"charge declined for order 1"}
	if len(audit.messages) != 1 || audit.messages[0] != want[0] {
		t.Fatalf("got %v, want %v", audit.messages, want)
	}
}

func TestAfter_SpyMailerRecordsTheMessageItSent(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(500))
	mailer := &spyMailer{}
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{result: ChargeApproved}, Mailer: mailer, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute(1); err != nil {
		t.Fatal(err)
	}
	want := []string{"ada@example.com|Your order 1 was cancelled"}
	if len(mailer.sent) != 1 || mailer.sent[0] != want[0] {
		t.Fatalf("got %v, want %v", mailer.sent, want)
	}
}

func TestAfter_MockGatewayFailsImmediatelyOnTheWrongChargeButAcceptsTheRightOne(t *testing.T) {
	wrongOrders := newInMemoryOrderRepository(anOrder(99900))
	wrongGateway := &mockPaymentGateway{expectedOrderID: 1, expectedAmountMinor: 500}
	wrongUseCase := CancelOrder{Orders: wrongOrders, Gateway: wrongGateway, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	err := wrongUseCase.Execute(1)
	if err == nil || !strings.Contains(err.Error(), "unexpected charge") {
		t.Fatalf("got error %v, want unexpected charge", err)
	}

	orders := newInMemoryOrderRepository(anOrder(500))
	gateway := &mockPaymentGateway{expectedOrderID: 1, expectedAmountMinor: 500}
	useCase := CancelOrder{Orders: orders, Gateway: gateway, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute(1); err != nil {
		t.Fatal(err)
	}
	if !gateway.called {
		t.Fatal("expected the mock to have been called")
	}
}

func TestAfter_FakeRepositorySavesTheCancelledOrder(t *testing.T) {
	orders := newInMemoryOrderRepository(anOrder(500))
	useCase := CancelOrder{Orders: orders, Gateway: stubPaymentGateway{result: ChargeApproved}, Mailer: &spyMailer{}, AuditLogger: nullAuditLogger{}}
	if err := useCase.Execute(1); err != nil {
		t.Fatal(err)
	}
	// Real behaviour: a later read reflects what an earlier write saved. If Save were
	// never called, Get would still return the untouched copy stored at construction time.
	saved, err := orders.Get(1)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Status != StatusCancelled {
		t.Fatalf("got status %q, want cancelled", saved.Status)
	}
}
