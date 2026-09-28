package sqlite

import (
	"database/sql"
	"errors"
	"fmt"

	"example.com/repository-example/domain"
	_ "modernc.org/sqlite"
)

func InitializeSchema(db *sql.DB) error {
	_, err := db.Exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL)")
	return err
}

// Caller owns db. Each write is one autocommitted statement.
type OrderRepository struct {
	db *sql.DB
}

func NewOrderRepository(db *sql.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

func (r *OrderRepository) Get(orderID int) (*domain.Order, error) {
	var order domain.Order
	err := r.db.QueryRow("SELECT id, status FROM orders WHERE id = ?", orderID).
		Scan(&order.ID, &order.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if order.Status != domain.Pending && order.Status != domain.Cancelled {
		return nil, fmt.Errorf("unknown order status: %q", order.Status)
	}
	return &order, nil
}

func (r *OrderRepository) Save(order domain.Order) error {
	_, err := r.db.Exec(
		"INSERT INTO orders (id, status) VALUES (?, ?) "+
			"ON CONFLICT(id) DO UPDATE SET status = excluded.status",
		order.ID, order.Status,
	)
	return err
}
