// Package before is a teaching artifact: the refund and customs decisions each walk straight
// through the customer's address to read its country -- a train wreck that breaks not by
// crashing, but by silently giving the wrong answer the day the country moves one hop further
// out.
package before

type Country struct {
	Code string
}

// Region is introduced later: countries are grouped under a customs region.
type Region struct {
	Country Country
}

type Address struct {
	// Exactly one of these is set: Country for an address created before the region
	// migration, Region for one created after it. Neither caller below knows about Region.
	Country *Country
	Region  *Region
}

type Customer struct {
	Address Address
}

type Order struct {
	Customer Customer
}

type CancellationPolicy struct{}

func (CancellationPolicy) CanAutoRefund(order Order) bool {
	// Train wreck: order -> Customer -> Address -> Country -> Code.
	address := order.Customer.Address
	if address.Country == nil {
		return false // play it safe: no auto-refund if we can't read a country
	}
	return address.Country.Code == "US"
}

type ReturnLabelPrinter struct{}

func (ReturnLabelPrinter) NeedsCustomsForm(order Order) bool {
	// Train wreck: order -> Customer -> Address -> Country -> Code.
	address := order.Customer.Address
	if address.Country == nil {
		return true // play it safe: assume a customs form is needed
	}
	return address.Country.Code != "US"
}
