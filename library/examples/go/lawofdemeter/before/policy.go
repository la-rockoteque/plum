// Package before is a teaching artifact: cancelling an order walks straight through the
// customer's address and wallet to decide how to ship the return and whether to auto-refund —
// a train wreck that breaks the moment one address turns out not to have a country.
package before

type Country struct {
	Code string
}

type Address struct {
	Country *Country // nil for a pickup point — no single country's customs apply
}

type Card struct {
	Expired bool
}

type Wallet struct {
	Card Card
}

type Customer struct {
	Address Address
	Wallet  Wallet
}

type Order struct {
	Customer Customer
}

type CancellationPolicy struct{}

func (CancellationPolicy) ShipsDomestically(order Order) bool {
	// Train wreck: order -> Customer -> Address -> Country -> Code.
	return order.Customer.Address.Country.Code == "US"
}

func (CancellationPolicy) CanAutoRefund(order Order) bool {
	// Train wreck: order -> Customer -> Wallet -> Card -> Expired.
	return !order.Customer.Wallet.Card.Expired
}
