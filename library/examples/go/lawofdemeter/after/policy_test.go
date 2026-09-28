package after

import "testing"

func TestAfter_OrderAsksItsCustomerForTheSameRefundAndCustomsDecisions(t *testing.T) {
	cancellation := CancellationPolicy{}
	labels := ReturnLabelPrinter{}

	domestic := Order{Customer: Customer{Address: Address{Country: &Country{Code: "US"}}}}
	if !cancellation.CanAutoRefund(domestic) {
		t.Fatal("want a domestic order to auto-refund")
	}
	if labels.NeedsCustomsForm(domestic) {
		t.Fatal("want a domestic order not to need a customs form")
	}

	foreign := Order{Customer: Customer{Address: Address{Country: &Country{Code: "CA"}}}}
	if cancellation.CanAutoRefund(foreign) {
		t.Fatal("want a foreign order not to auto-refund")
	}
	if !labels.NeedsCustomsForm(foreign) {
		t.Fatal("want a foreign order to need a customs form")
	}
}

func TestAfter_TheSameCallerCodeAnswersCorrectlyOnceAddressOwnsTheRegionMigratedShape(t *testing.T) {
	cancellation := CancellationPolicy{}
	labels := ReturnLabelPrinter{}

	migratedDomestic := Order{Customer: Customer{Address: Address{
		Region: &Region{Country: Country{Code: "US"}},
	}}}
	if !cancellation.CanAutoRefund(migratedDomestic) {
		t.Fatal("want the after caller to correctly auto-refund once address owns the region shape")
	}
	if labels.NeedsCustomsForm(migratedDomestic) {
		t.Fatal("want the after caller to correctly skip the customs form once address owns the region shape")
	}
}

func TestAfter_APickupPointAddressWithNoCountryOrRegionIsTreatedAsNonDomesticWithoutCrashing(t *testing.T) {
	cancellation := CancellationPolicy{}
	labels := ReturnLabelPrinter{}

	pickupPoint := Order{Customer: Customer{Address: Address{}}}
	if cancellation.CanAutoRefund(pickupPoint) {
		t.Fatal("want a pickup point address not to auto-refund")
	}
	if !labels.NeedsCustomsForm(pickupPoint) {
		t.Fatal("want a pickup point address to need a customs form")
	}
}
