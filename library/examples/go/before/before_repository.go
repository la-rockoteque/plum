package before

import (
	"database/sql"
	"errors"
)

type CancelOrder struct {
	DB *sql.DB
}

func (c CancelOrder) Execute(orderID int) error {
	// SQL, table/column names, and the business rule live together.
	// Tests need persistence; a storage change can force application changes.
	var status string
	err := c.DB.QueryRow("SELECT status FROM orders WHERE id = ?", orderID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("order not found")
	}
	if err != nil {
		return err
	}
	if status == "cancelled" {
		return errors.New("order already cancelled")
	}
	_, err = c.DB.Exec("UPDATE orders SET status = 'cancelled' WHERE id = ?", orderID)
	return err
}
