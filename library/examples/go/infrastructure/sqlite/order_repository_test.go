package sqlite_test

import (
	"database/sql"
	"testing"

	"example.com/repository-example/application"
	"example.com/repository-example/before"
	"example.com/repository-example/domain"
	"example.com/repository-example/infrastructure/memory"
	"example.com/repository-example/infrastructure/sqlite"
)

func openDatabase(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	db.SetMaxOpenConns(1)
	if err := sqlite.InitializeSchema(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestRepositoryContract(t *testing.T) {
	for _, adapter := range []string{"memory", "sqlite"} {
		t.Run(adapter, func(t *testing.T) {
			var repository application.OrderRepository = memory.NewOrderRepository()
			if adapter == "sqlite" {
				repository = sqlite.NewOrderRepository(openDatabase(t))
			}
			if order, err := repository.Get(42); err != nil || order != nil {
				t.Fatalf("unknown order: %+v, %v", order, err)
			}
			original := domain.Order{ID: 1, Status: domain.Pending}
			if err := repository.Save(original); err != nil {
				t.Fatal(err)
			}
			if err := original.Cancel(); err != nil {
				t.Fatal(err)
			}
			loaded, err := repository.Get(1)
			if err != nil || loaded == nil || *loaded != (domain.Order{ID: 1, Status: domain.Pending}) {
				t.Fatalf("round trip: %+v, %v", loaded, err)
			}
			if err := loaded.Cancel(); err != nil {
				t.Fatal(err)
			}
			if order, err := repository.Get(1); err != nil || order == nil || order.Status != domain.Pending {
				t.Fatalf("mutation persisted without Save: %+v, %v", order, err)
			}
			if err := repository.Save(*loaded); err != nil {
				t.Fatal(err)
			}
			if order, err := repository.Get(1); err != nil || order == nil || order.Status != domain.Cancelled {
				t.Fatalf("update: %+v, %v", order, err)
			}
		})
	}
}

func TestCoupledExample(t *testing.T) {
	db := openDatabase(t)
	repository := sqlite.NewOrderRepository(db)
	if err := repository.Save(domain.Order{ID: 1, Status: domain.Pending}); err != nil {
		t.Fatal(err)
	}
	cancel := before.CancelOrder{DB: db}
	if err := cancel.Execute(1); err != nil {
		t.Fatal(err)
	}
	if order, err := repository.Get(1); err != nil || order == nil || order.Status != domain.Cancelled {
		t.Fatalf("cancel: %+v, %v", order, err)
	}
	for _, id := range []int{1, 42} {
		if err := cancel.Execute(id); err == nil {
			t.Fatalf("expected cancellation of order %d to fail", id)
		}
	}
	if _, err := db.Exec("UPDATE orders SET status = 'invalid' WHERE id = 1"); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.Get(1); err == nil {
		t.Fatal("accepted an unknown stored status")
	}
}
