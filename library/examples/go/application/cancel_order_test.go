package application_test

import (
	"errors"
	"testing"

	"example.com/repository-example/application"
	"example.com/repository-example/domain"
	"example.com/repository-example/infrastructure/memory"
)

func TestCancelOrder(t *testing.T) {
	for _, tc := range []struct {
		name    string
		order   *domain.Order
		wantErr error
	}{
		{"pending", &domain.Order{ID: 1, Status: domain.Pending}, nil},
		{"unknown", nil, application.ErrOrderNotFound},
		{"cancelled", &domain.Order{ID: 1, Status: domain.Cancelled}, domain.ErrOrderAlreadyCancelled},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repository := memory.NewOrderRepository()
			if tc.order != nil {
				if err := repository.Save(*tc.order); err != nil {
					t.Fatal(err)
				}
			}
			err := application.NewCancelOrder(repository).Execute(1)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("got %v, want %v", err, tc.wantErr)
			}
			order, err := repository.Get(1)
			if err != nil {
				t.Fatal(err)
			}
			if tc.order == nil {
				if order != nil {
					t.Fatal("unknown order was created")
				}
			} else if order == nil || order.Status != domain.Cancelled {
				t.Fatalf("unexpected saved order: %+v", order)
			}
		})
	}
}

// A tiny failing port verifies that the use case doesn't swallow storage errors.
type failingRepository struct {
	loadError error
	saveError error
}

func (r failingRepository) Get(int) (*domain.Order, error) {
	return &domain.Order{ID: 1, Status: domain.Pending}, r.loadError
}

func (r failingRepository) Save(domain.Order) error { return r.saveError }

func TestStorageFailuresPropagate(t *testing.T) {
	failure := errors.New("storage unavailable")
	for _, repository := range []failingRepository{{loadError: failure}, {saveError: failure}} {
		if err := application.NewCancelOrder(repository).Execute(1); !errors.Is(err, failure) {
			t.Fatalf("storage failure lost: %v", err)
		}
	}
}
