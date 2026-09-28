// Package before is a teaching artifact: presentation parsing, the cancellation
// rule and SQL all live in one function.
package before

import (
	"database/sql"
	"fmt"
	"strconv"
)

type CancelRequest struct {
	OrderID string // arrives as a string, as it would from a web request
}

type CancelResponse struct {
	Status  string // "ok" | "invalid" | "not_found" | "rejected"
	Message string
}

func HandleCancelRequest(request CancelRequest, db *sql.DB) (CancelResponse, error) {
	// Parsing, the cancellation rule, and SQL all live in one function: a rule change
	// and a column rename both force an edit here, and proving the rule needs a database.
	orderID, err := strconv.Atoi(request.OrderID)
	if err != nil {
		return CancelResponse{"invalid", "order id must be a number"}, nil
	}

	var status string
	err = db.QueryRow("SELECT status FROM orders WHERE id = ?", orderID).Scan(&status)
	if err == sql.ErrNoRows {
		return CancelResponse{"not_found", fmt.Sprintf("order %d not found", orderID)}, nil
	}
	if err != nil {
		return CancelResponse{}, err
	}
	if status == "shipped" || status == "cancelled" {
		return CancelResponse{"rejected", fmt.Sprintf("order %d already %s", orderID, status)}, nil
	}
	if _, err := db.Exec("UPDATE orders SET status = 'cancelled' WHERE id = ?", orderID); err != nil {
		return CancelResponse{}, err
	}
	return CancelResponse{"ok", fmt.Sprintf("order %d cancelled", orderID)}, nil
}
