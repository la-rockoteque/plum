package main

import (
	"database/sql"
	"errors"
	"fmt"
	"log"

	"example.com/repository-example/application"
	"example.com/repository-example/domain"
	_ "example.com/repository-example/infrastructure/sqlite"
	"example.com/repository-example/orm"
	"example.com/repository-example/uow"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	connection, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		return err
	}
	defer connection.Close()
	connection.SetMaxOpenConns(1)
	db, err := orm.Open(connection, false)
	if err != nil {
		return err
	}
	if err := db.AutoMigrate(&orm.OrderRow{}); err != nil {
		return err
	}
	repository := orm.NewOrderRepository(db)
	for _, mode := range []string{"before", "rollback", "commit"} {
		for _, id := range []int{1, 2} {
			if err := repository.Save(domain.Order{ID: id, Status: domain.Pending}); err != nil {
				return err
			}
		}
		ids := []int{1, 404}
		if mode == "commit" {
			ids = []int{1, 2}
		}
		if mode == "before" {
			cancel := application.NewCancelOrder(repository)
			for _, id := range ids {
				err = cancel.Execute(id)
				if err != nil {
					break
				}
			}
		} else {
			err = uow.CancelOrders(db, ids)
		}
		if mode == "commit" && err != nil {
			return err
		}
		if mode != "commit" && !errors.Is(err, application.ErrOrderNotFound) {
			return fmt.Errorf("expected missing order, got %v", err)
		}
		var first, second string
		if err := connection.QueryRow("SELECT status FROM orders WHERE id = 1").Scan(&first); err != nil {
			return err
		}
		if err := connection.QueryRow("SELECT status FROM orders WHERE id = 2").Scan(&second); err != nil {
			return err
		}
		wantFirst, wantSecond := "cancelled", "pending"
		if mode == "rollback" {
			wantFirst = "pending"
		}
		if mode == "commit" {
			wantSecond = "cancelled"
		}
		if first != wantFirst || second != wantSecond {
			return fmt.Errorf("unexpected state: %s, %s", first, second)
		}
		fmt.Printf("%s: %s, %s\n", mode, first, second)
	}
	return nil
}
