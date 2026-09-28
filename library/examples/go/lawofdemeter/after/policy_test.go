package after

import "testing"

func TestAfter_OrderAsksItsCustomerWhoAsksItsOwnCollaboratorsForTheSameDecisions(t *testing.T) {
	policy := CancellationPolicy{}

	domestic := Order{Customer: Customer{
		Address: Address{Country: &Country{Code: "US"}},
		Wallet:  Wallet{Card: Card{Expired: false}},
	}}
	if !policy.ShipsDomestically(domestic) {
		t.Fatal("want domestic order to ship domestically")
	}
	if !policy.CanAutoRefund(domestic) {
		t.Fatal("want domestic order with a valid card to auto-refund")
	}

	foreign := Order{Customer: Customer{
		Address: Address{Country: &Country{Code: "CA"}},
		Wallet:  Wallet{Card: Card{Expired: true}},
	}}
	if policy.ShipsDomestically(foreign) {
		t.Fatal("want foreign order not to ship domestically")
	}
	if policy.CanAutoRefund(foreign) {
		t.Fatal("want an order with an expired card not to auto-refund")
	}
}

func TestAfter_APickupPointAddressWithoutACountryNoLongerBreaksTheShippingCheck(t *testing.T) {
	policy := CancellationPolicy{}
	order := Order{Customer: Customer{
		Address: Address{Country: nil},
		Wallet:  Wallet{Card: Card{Expired: false}},
	}}
	if policy.ShipsDomestically(order) {
		t.Fatal("want a pickup point address to ship non-domestically, not panic")
	}
	if !policy.CanAutoRefund(order) {
		t.Fatal("want a valid card to still auto-refund")
	}
}
