package queries_test

import (
	"errors"
	"testing"

	"example.com/repository-example/application"
	"example.com/repository-example/cqrs/before"
	readmemory "example.com/repository-example/cqrs/memory"
	"example.com/repository-example/cqrs/queries"
	"example.com/repository-example/domain"
	"example.com/repository-example/infrastructure/memory"
)

func TestQueriesAreSnapshotsAndCommandsKeepDomainRules(t *testing.T) {
	repository := memory.NewOrderRepository()
	if err := repository.Save(domain.Order{ID: 1, Status: domain.Pending}); err != nil {
		t.Fatal(err)
	}
	query := queries.NewGetOrderSummary(readmemory.NewOrderSummaryReader(repository))
	before, err := query.Execute(1)
	wantBefore := queries.OrderSummary{ID: 1, Status: "pending", CanCancel: true}
	if err != nil || before == nil || *before != wantBefore {
		t.Fatalf("unexpected summary: %+v, %v", before, err)
	}
	if order, err := repository.Get(1); err != nil || order == nil || order.Status != domain.Pending {
		t.Fatalf("query changed state: %+v, %v", order, err)
	}
	if err := application.NewCancelOrder(repository).Execute(1); err != nil {
		t.Fatal(err)
	}
	if after, err := query.Execute(1); err != nil || after == nil ||
		*after != (queries.OrderSummary{ID: 1, Status: "cancelled", CanCancel: false}) {
		t.Fatalf("command not visible: %+v, %v", after, err)
	}
	if *before != wantBefore {
		t.Fatal("old summary changed")
	}
	if err := application.NewCancelOrder(repository).Execute(1); !errors.Is(err, domain.ErrOrderAlreadyCancelled) {
		t.Fatalf("domain rule lost: %v", err)
	}
}

func TestUnknownQueryDoesNotCreateOrder(t *testing.T) {
	repository := memory.NewOrderRepository()
	reader := readmemory.NewOrderSummaryReader(repository)
	if summary, err := reader.GetSummary(42); err != nil || summary != nil {
		t.Fatalf("unknown summary: %+v, %v", summary, err)
	}
	if _, err := queries.NewGetOrderSummary(reader).Execute(42); !errors.Is(err, application.ErrOrderNotFound) {
		t.Fatalf("unknown query: %v", err)
	}
	if order, err := repository.Get(42); err != nil || order != nil {
		t.Fatalf("query created order: %+v, %v", order, err)
	}
}

type failingReader struct{ err error }

func (r failingReader) GetSummary(int) (*queries.OrderSummary, error) { return nil, r.err }

func TestReadFailureReachesCaller(t *testing.T) {
	failure := errors.New("storage unavailable")
	if _, err := queries.NewGetOrderSummary(failingReader{failure}).Execute(1); !errors.Is(err, failure) {
		t.Fatalf("read failure lost: %v", err)
	}
}

func TestBeforeReturnsWriteModel(t *testing.T) {
	repository := memory.NewOrderRepository()
	if err := repository.Save(domain.Order{ID: 1, Status: domain.Pending}); err != nil {
		t.Fatal(err)
	}
	service := before.NewOrderService(repository)
	order, err := service.CancelAndGet(1)
	if err != nil || order == nil || order.Status != domain.Cancelled {
		t.Fatalf("unexpected write model: %+v, %v", order, err)
	}
	if _, err := service.CancelAndGet(1); !errors.Is(err, domain.ErrOrderAlreadyCancelled) {
		t.Fatalf("domain rule lost: %v", err)
	}
	if _, err := service.CancelAndGet(42); !errors.Is(err, application.ErrOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
}
