package sqlite

import (
	"database/sql"
	"errors"

	"example.com/repository-example/cqrs/queries"
)

type OrderSummaryReader struct {
	db *sql.DB
}

func NewOrderSummaryReader(db *sql.DB) OrderSummaryReader {
	return OrderSummaryReader{db: db}
}

func (r OrderSummaryReader) GetSummary(orderID int) (*queries.OrderSummary, error) {
	// Project straight into display data; don't load a domain entity.
	var summary queries.OrderSummary
	err := r.db.QueryRow(
		"SELECT id, status, status = 'pending' FROM orders WHERE id = ?", orderID,
	).Scan(&summary.ID, &summary.Status, &summary.CanCancel)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &summary, nil
}
