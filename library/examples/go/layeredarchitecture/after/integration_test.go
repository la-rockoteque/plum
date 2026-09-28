package after_test

import (
	"database/sql"
	"testing"

	"example.com/repository-example/layeredarchitecture/after"
	_ "modernc.org/sqlite"
)

func TestAfter_PresentationApplicationDomainAndDataCancelAnOrderOnSqlite(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if err := after.InitializeSchema(db); err != nil {
		t.Fatal(err)
	}
	repository := after.NewSqliteOrderRepository(db)
	if err := repository.Save(after.Order{ID: 1, Status: after.Pending}); err != nil {
		t.Fatal(err)
	}
	if err := repository.Save(after.Order{ID: 2, Status: after.Shipped}); err != nil {
		t.Fatal(err)
	}

	useCase := after.CancelOrder{Repository: repository}
	response := after.HandleCancelRequest(after.CancelRequest{OrderID: "1"}, useCase)
	if response != (after.CancelResponse{Status: "ok", Message: "order 1 cancelled"}) {
		t.Fatalf("got %+v", response)
	}
	order, err := repository.Get(1)
	if err != nil || order == nil || order.Status != after.Cancelled {
		t.Fatalf("got %+v, %v", order, err)
	}
	if got := after.HandleCancelRequest(after.CancelRequest{OrderID: "2"}, useCase).Status; got != "rejected" {
		t.Fatalf("got %q", got)
	}
	if got := after.HandleCancelRequest(after.CancelRequest{OrderID: "42"}, useCase).Status; got != "not_found" {
		t.Fatalf("got %q", got)
	}
	if got := after.HandleCancelRequest(after.CancelRequest{OrderID: "nope"}, useCase).Status; got != "invalid" {
		t.Fatalf("got %q", got)
	}
}
