package after_test

import (
	"testing"

	"example.com/repository-example/layeredarchitecture/after"
)

type fakeCancelOrder struct {
	err        error
	calledWith int
}

func (f *fakeCancelOrder) Execute(orderID int) error {
	f.calledWith = orderID
	return f.err
}

func TestAfter_TheHandlerCancelsThroughAFakeApplicationService(t *testing.T) {
	useCase := &fakeCancelOrder{}
	response := after.HandleCancelRequest(after.CancelRequest{OrderID: "1"}, useCase)
	if response != (after.CancelResponse{Status: "ok", Message: "order 1 cancelled"}) {
		t.Fatalf("got %+v", response)
	}
	if useCase.calledWith != 1 {
		t.Fatalf("use case called with %d", useCase.calledWith)
	}

	if got := after.HandleCancelRequest(after.CancelRequest{OrderID: "nope"}, &fakeCancelOrder{}).Status; got != "invalid" {
		t.Fatalf("got %q", got)
	}
	if got := after.HandleCancelRequest(after.CancelRequest{OrderID: "1"}, &fakeCancelOrder{err: after.ErrOrderNotFound}).Status; got != "not_found" {
		t.Fatalf("got %q", got)
	}
	if got := after.HandleCancelRequest(after.CancelRequest{OrderID: "1"}, &fakeCancelOrder{err: after.ErrOrderCannotBeCancelled}).Status; got != "rejected" {
		t.Fatalf("got %q", got)
	}
}
