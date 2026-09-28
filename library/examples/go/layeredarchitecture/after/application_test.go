package after_test

import (
	"errors"
	"testing"

	"example.com/repository-example/layeredarchitecture/after"
)

func TestAfter_TheApplicationServiceCancelsThroughAnInMemoryRepository(t *testing.T) {
	repository := after.NewInMemoryOrderRepository()
	if err := repository.Save(after.Order{ID: 1, Status: after.Pending}); err != nil {
		t.Fatal(err)
	}
	if err := (after.CancelOrder{Repository: repository}).Execute(1); err != nil {
		t.Fatal(err)
	}
	order, err := repository.Get(1)
	if err != nil || order == nil || order.Status != after.Cancelled {
		t.Fatalf("got %+v, %v", order, err)
	}

	if err := (after.CancelOrder{Repository: repository}).Execute(42); !errors.Is(err, after.ErrOrderNotFound) {
		t.Fatalf("got %v", err)
	}

	if err := repository.Save(after.Order{ID: 2, Status: after.Shipped}); err != nil {
		t.Fatal(err)
	}
	if err := (after.CancelOrder{Repository: repository}).Execute(2); !errors.Is(err, after.ErrOrderCannotBeCancelled) {
		t.Fatalf("got %v", err)
	}
}
