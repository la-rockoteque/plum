package main

import (
	"database/sql"
	"fmt"
	"os"

	"example.com/repository-example/application"
	"example.com/repository-example/domain"
	"example.com/repository-example/infrastructure/sqlite"
	"example.com/repository-example/orm"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 || (args[0] != "raw" && args[0] != "orm" && args[0] != "sql") {
		return fmt.Errorf("usage: go run ./cmd/orm-demo raw|orm|sql")
	}
	connection, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return err
	}
	defer connection.Close()
	connection.SetMaxOpenConns(1)
	var repository application.OrderRepository
	if args[0] == "raw" {
		if err := sqlite.InitializeSchema(connection); err != nil {
			return err
		}
		repository = sqlite.NewOrderRepository(connection)
	} else {
		db, err := orm.Open(connection, args[0] == "sql")
		if err != nil {
			return err
		}
		if err := db.AutoMigrate(&orm.OrderRow{}); err != nil {
			return err
		}
		repository = orm.NewOrderRepository(db)
	}
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
	if order == nil {
		return fmt.Errorf("order disappeared")
	}
	fmt.Printf("Order %d: %s\n", order.ID, order.Status)
	return nil
}
