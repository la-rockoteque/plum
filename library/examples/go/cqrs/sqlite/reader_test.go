package sqlite_test

import (
	"database/sql"
	"errors"
	"testing"

	"example.com/repository-example/application"
	"example.com/repository-example/cqrs/queries"
	readsqlite "example.com/repository-example/cqrs/sqlite"
	"example.com/repository-example/domain"
	"example.com/repository-example/infrastructure/sqlite"
)

func TestReadAndWriteModelsShareOneDatabase(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if err := sqlite.InitializeSchema(db); err != nil {
		t.Fatal(err)
	}
	repository := sqlite.NewOrderRepository(db)
	reader := readsqlite.NewOrderSummaryReader(db)
	query := queries.NewGetOrderSummary(reader)
	if summary, err := reader.GetSummary(42); err != nil || summary != nil {
		t.Fatalf("unknown summary: %+v, %v", summary, err)
	}
	if _, err := query.Execute(42); !errors.Is(err, application.ErrOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
	if err := repository.Save(domain.Order{ID: 1, Status: domain.Pending}); err != nil {
		t.Fatal(err)
	}
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
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := query.Execute(1); err == nil || errors.Is(err, application.ErrOrderNotFound) {
		t.Fatalf("storage failure misreported: %v", err)
	}
}
