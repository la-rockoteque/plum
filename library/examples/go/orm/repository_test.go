package orm_test

import (
	"database/sql"
	"errors"
	"testing"

	"example.com/repository-example/application"
	"example.com/repository-example/domain"
	_ "example.com/repository-example/infrastructure/sqlite"
	"example.com/repository-example/orm"
)

func TestGormKeepsRepositoryContract(t *testing.T) {
	connection, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	connection.SetMaxOpenConns(1)
	db, err := orm.Open(connection, false)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&orm.OrderRow{}); err != nil {
		t.Fatal(err)
	}
	repository := orm.NewOrderRepository(db)
	if order, err := repository.Get(42); err != nil || order != nil {
		t.Fatalf("unknown order: %+v, %v", order, err)
	}
	if err := application.NewCancelOrder(repository).Execute(42); !errors.Is(err, application.ErrOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
	original := domain.Order{ID: 1, Status: domain.Pending}
	if err := repository.Save(original); err != nil {
		t.Fatal(err)
	}
	if err := original.Cancel(); err != nil {
		t.Fatal(err)
	}
	loaded, err := repository.Get(1)
	if err != nil || loaded == nil || loaded.Status != domain.Pending {
		t.Fatalf("round trip: %+v, %v", loaded, err)
	}
	if err := loaded.Cancel(); err != nil {
		t.Fatal(err)
	}
	if order, err := repository.Get(1); err != nil || order == nil || order.Status != domain.Pending {
		t.Fatalf("unsaved mutation leaked: %+v, %v", order, err)
	}
	if err := application.NewCancelOrder(repository).Execute(1); err != nil {
		t.Fatal(err)
	}
	if order, err := repository.Get(1); err != nil || order == nil || order.Status != domain.Cancelled {
		t.Fatalf("cancellation not saved: %+v, %v", order, err)
	}
	if err := application.NewCancelOrder(repository).Execute(1); !errors.Is(err, domain.ErrOrderAlreadyCancelled) {
		t.Fatalf("domain rule lost: %v", err)
	}
	var count int
	var status string
	if err := connection.QueryRow("SELECT COUNT(*), MAX(status) FROM orders").Scan(&count, &status); err != nil {
		t.Fatal(err)
	}
	if count != 1 || status != "cancelled" {
		t.Fatalf("raw SQL disagrees: %d, %s", count, status)
	}
	if _, err := connection.Exec("UPDATE orders SET status = 'invalid' WHERE id = 1"); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.Get(1); err == nil {
		t.Fatal("accepted unknown status")
	}
	if err := connection.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := repository.Get(1); err == nil {
		t.Fatal("read failure lost")
	}
	if err := repository.Save(domain.Order{ID: 2, Status: domain.Pending}); err == nil {
		t.Fatal("write failure lost")
	}
}
