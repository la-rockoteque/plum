package before_test

import (
	"database/sql"
	"testing"

	"example.com/repository-example/layeredarchitecture/before"
	_ "modernc.org/sqlite"
)

func TestBefore_ProvingTheCancellationRuleRequiresARequestAndADatabase(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	if _, err := db.Exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, status TEXT)"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec("INSERT INTO orders VALUES (1, 'pending'), (2, 'shipped')"); err != nil {
		t.Fatal(err)
	}

	response, err := before.HandleCancelRequest(before.CancelRequest{OrderID: "1"}, db)
	if err != nil || response != (before.CancelResponse{Status: "ok", Message: "order 1 cancelled"}) {
		t.Fatalf("got %+v, %v", response, err)
	}
	var status string
	if err := db.QueryRow("SELECT status FROM orders WHERE id = 1").Scan(&status); err != nil || status != "cancelled" {
		t.Fatalf("got status %q, %v", status, err)
	}

	// Proving the rule (a shipped order can't be cancelled) needs this same database.
	for id, want := range map[string]string{"2": "rejected", "1": "rejected", "42": "not_found", "nope": "invalid"} {
		response, err := before.HandleCancelRequest(before.CancelRequest{OrderID: id}, db)
		if err != nil || response.Status != want {
			t.Fatalf("order %s: got %+v, %v, want status %q", id, response, err, want)
		}
	}
}
