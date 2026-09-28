package before

import "testing"

func TestBefore_ShippingAndRefundDecisionsWalkTheCustomersAddressAndWalletDirectly(t *testing.T) {
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

func TestBefore_APickupPointAddressWithoutACountryBreaksTheShippingCheck(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("want a panic reaching through the missing country, got none")
		}
	}()

	policy := CancellationPolicy{}
	order := Order{Customer: Customer{
		Address: Address{Country: nil},
		Wallet:  Wallet{Card: Card{Expired: false}},
	}}
	policy.ShipsDomestically(order)
}
