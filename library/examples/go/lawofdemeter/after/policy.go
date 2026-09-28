// Package after: each object only talks to its own data or its direct collaborator. Address
// answers "domestic?" for itself whether it still holds a plain country or, after the region
// migration, a Region one hop further out -- so the callers below never learn the new shape.
package after

type Country struct {
	Code string
}

type Region struct {
	Country Country
}

// IsDomestic asks its own direct collaborator, Country.
func (r Region) IsDomestic() bool {
	return r.Country.Code == "US"
}

type Address struct {
	Country *Country
	Region  *Region
}

// IsDomestic answers using only its own field, whichever shape this address has.
func (a Address) IsDomestic() bool {
	if a.Region != nil {
		return a.Region.IsDomestic()
	}
	if a.Country != nil {
		return a.Country.Code == "US"
	}
	return false // a pickup point has no single country either
}

type Customer struct {
	Address Address
}

func (c Customer) CanAutoRefund() bool {
	return c.Address.IsDomestic()
}

func (c Customer) NeedsCustomsForm() bool {
	return !c.Address.IsDomestic()
}

type Order struct {
	Customer Customer
}

func (o Order) CanAutoRefund() bool {
	return o.Customer.CanAutoRefund()
}

func (o Order) NeedsCustomsForm() bool {
	return o.Customer.NeedsCustomsForm()
}

type CancellationPolicy struct{}

func (CancellationPolicy) CanAutoRefund(order Order) bool {
	return order.CanAutoRefund()
}

type ReturnLabelPrinter struct{}

func (ReturnLabelPrinter) NeedsCustomsForm(order Order) bool {
	return order.NeedsCustomsForm()
}
