package uow_test

import (
	"database/sql"
	"errors"
	"testing"

	"example.com/repository-example/application"
	"example.com/repository-example/domain"
	_ "example.com/repository-example/infrastructure/sqlite"
	"example.com/repository-example/orm"
	"example.com/repository-example/uow"
)

func TestRollbackAndSubsequentCommit(t *testing.T) {
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
	for _, id := range []int{1, 2} {
		if err := repository.Save(domain.Order{ID: id, Status: domain.Pending}); err != nil {
			t.Fatal(err)
		}
	}
	for _, failure := range []struct {
		ids  []int
		want error
	}{
		{[]int{1, 404}, application.ErrOrderNotFound},
		{[]int{1, 1}, domain.ErrOrderAlreadyCancelled},
	} {
		if err := uow.CancelOrders(db, failure.ids); !errors.Is(err, failure.want) {
			t.Fatalf("got %v, want %v", err, failure.want)
		}
		for _, id := range []int{1, 2} {
			order, err := repository.Get(id)
			if err != nil || order == nil || order.Status != domain.Pending {
				t.Fatalf("rollback: %+v, %v", order, err)
			}
		}
	}
	if err := uow.CancelOrders(db, []int{1, 2}); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int{1, 2} {
		order, err := repository.Get(id)
		if err != nil || order == nil || order.Status != domain.Cancelled {
			t.Fatalf("commit: %+v, %v", order, err)
		}
	}
}
