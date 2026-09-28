package main

import (
	"database/sql"
	"fmt"
	"os"

	"example.com/repository-example/application"
	"example.com/repository-example/cqrs/before"
	readmemory "example.com/repository-example/cqrs/memory"
	"example.com/repository-example/cqrs/queries"
	readsqlite "example.com/repository-example/cqrs/sqlite"
	"example.com/repository-example/domain"
	"example.com/repository-example/infrastructure/memory"
	"example.com/repository-example/infrastructure/sqlite"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: go run ./cmd/cqrs-demo before|memory|sqlite")
	}
	switch args[0] {
	case "before":
		repository := memory.NewOrderRepository()
		if err := repository.Save(domain.Order{ID: 1, Status: domain.Pending}); err != nil {
			return err
		}
		order, err := before.NewOrderService(repository).CancelAndGet(1)
		if err != nil {
			return err
		}
		fmt.Printf("Order %d: %s\n", order.ID, order.Status)
		return nil
	case "memory":
		repository := memory.NewOrderRepository()
		return demonstrate(repository, readmemory.NewOrderSummaryReader(repository))
	case "sqlite":
		db, err := sql.Open("sqlite", ":memory:")
		if err != nil {
			return err
		}
		defer db.Close()
		// Keep the read and write sides on the same in-memory database.
		db.SetMaxOpenConns(1)
		if err := sqlite.InitializeSchema(db); err != nil {
			return err
		}
		return demonstrate(sqlite.NewOrderRepository(db), readsqlite.NewOrderSummaryReader(db))
	default:
		return fmt.Errorf("usage: go run ./cmd/cqrs-demo before|memory|sqlite")
	}
}

func demonstrate(repository application.OrderRepository, reader queries.OrderSummaryReader) error {
	if err := repository.Save(domain.Order{ID: 1, Status: domain.Pending}); err != nil {
		return err
	}
	query := queries.NewGetOrderSummary(reader)
	before, err := query.Execute(1)
	if err != nil {
		return err
	}
	if err := application.NewCancelOrder(repository).Execute(1); err != nil {
		return err
	}
	after, err := query.Execute(1)
	if err != nil {
		return err
	}
	fmt.Printf("Before: %s, can_cancel=%t\n", before.Status, before.CanCancel)
	fmt.Printf("After: %s, can_cancel=%t\n", after.Status, after.CanCancel)
	return nil
}
