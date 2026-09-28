// Package before: the only persistence contract available. CancelOrder depends on
// all seven methods of OrderStoreV1 even though it only ever calls two of them.
package before

type Order struct {
	ID            int
	CustomerEmail string
	AmountMinor   int
	Status        string
}

func NewOrder(id int, customerEmail string, amountMinor int) *Order {
	return &Order{ID: id, CustomerEmail: customerEmail, AmountMinor: amountMinor, Status: "pending"}
}

type OrderStoreV1 interface {
	Get(orderID int) (*Order, error)
	Save(order *Order) error
	Delete(orderID int) error
	ListByCustomer(customerEmail string) ([]*Order, error)
	ExportCsv() (string, error)
	AuditTrail(orderID int) ([]string, error)
	PurgeOlderThan(days int) (int, error)
}

// OrderStoreV2 grows an eighth method. Every implementer -- including a fake written
// for a use case that never touches archiving -- must grow with it.
type OrderStoreV2 interface {
	OrderStoreV1
	Archive(orderID int) error
}

// CancelOrder depends on the whole fat interface, though it only ever calls Get and Save.
type CancelOrder struct {
	Store OrderStoreV1
}

func (c CancelOrder) Execute(orderID int) error {
	order, err := c.Store.Get(orderID)
	if err != nil {
		return err
	}
	order.Status = "cancelled"
	return c.Store.Save(order)
}
