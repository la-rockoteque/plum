// Package after: each object only talks to its own data or its direct collaborator; the caller
// asks Order one question at a time. A pickup point's missing country is absorbed where it
// lives, in Address, instead of blowing up three hops away.
package after

type Country struct {
	Code string
}

type Address struct {
	Country *Country // nil for a pickup point
}

// IsDomestic answers using only its own field.
func (a Address) IsDomestic() bool {
	return a.Country != nil && a.Country.Code == "US"
}

type Card struct {
	Expired bool
}

func (c Card) IsExpired() bool {
	return c.Expired
}

type Wallet struct {
	Card Card
}

// HasValidCard asks its own direct collaborator, the card.
func (w Wallet) HasValidCard() bool {
	return !w.Card.IsExpired()
}

type Customer struct {
	Address Address
	Wallet  Wallet
}

func (c Customer) ShipsDomestically() bool {
	return c.Address.IsDomestic()
}

func (c Customer) CanAutoRefund() bool {
	return c.Wallet.HasValidCard()
}

type Order struct {
	Customer Customer
}

func (o Order) ReturnsShipDomestically() bool {
	return o.Customer.ShipsDomestically()
}

func (o Order) CanAutoRefund() bool {
	return o.Customer.CanAutoRefund()
}

type CancellationPolicy struct{}

func (CancellationPolicy) ShipsDomestically(order Order) bool {
	return order.ReturnsShipDomestically()
}

func (CancellationPolicy) CanAutoRefund(order Order) bool {
	return order.CanAutoRefund()
}
