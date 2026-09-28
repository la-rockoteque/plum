package main

import (
	"database/sql"
	"fmt"
	"os"

	"example.com/repository-example/application"
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
		return fmt.Errorf("usage: go run ./cmd/demo memory|sqlite")
	}
	// Composition root: only construction changes when selecting an adapter.
	switch args[0] {
	case "memory":
		return demonstrate(memory.NewOrderRepository())
	case "sqlite":
		db, err := sql.Open("sqlite", ":memory:")
		if err != nil {
			return err
		}
		defer db.Close()
		// An in-memory SQLite database belongs to one connection.
		db.SetMaxOpenConns(1)
		if err := sqlite.InitializeSchema(db); err != nil {
			return err
		}
		return demonstrate(sqlite.NewOrderRepository(db))
	default:
		return fmt.Errorf("usage: go run ./cmd/demo memory|sqlite")
	}
}

func demonstrate(repository application.OrderRepository) error {
	if err := repository.Save(domain.Order{ID: 1, Status: domain.Pending}); err != nil {
		return err
	}
	if err := application.NewCancelOrder(repository).Execute(1); err != nil {
		return err
	}
	order, err := repository.Get(1)
	if err != nil {
		return err
	}
	if order == nil || order.Status != domain.Cancelled {
		return fmt.Errorf("cancel failed")
	}
	fmt.Printf("Order %d: %s\n", order.ID, order.Status)
	return nil
}
