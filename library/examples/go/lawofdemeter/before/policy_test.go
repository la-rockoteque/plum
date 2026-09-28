package before

import "testing"

func TestBefore_RefundAndCustomsDecisionsWalkTheCustomersAddressDirectlyForOrdinaryAddresses(t *testing.T) {
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

func TestBefore_ARegionMigratedDomesticAddressIsWronglyTreatedAsNonDomesticByBothDistantCallers(t *testing.T) {
	cancellation := CancellationPolicy{}
	labels := ReturnLabelPrinter{}

	migratedDomestic := Order{Customer: Customer{Address: Address{
		Region: &Region{Country: Country{Code: "US"}},
	}}}
	// Both callers still only know how to read Address.Country; neither has been taught
	// about Region, so both get the same, wrong, conservative answer.
	if cancellation.CanAutoRefund(migratedDomestic) {
		t.Fatal("want the before caller to (wrongly) refuse auto-refund once country moves under region")
	}
	if !labels.NeedsCustomsForm(migratedDomestic) {
		t.Fatal("want the before caller to (wrongly) demand a customs form once country moves under region")
	}
}
