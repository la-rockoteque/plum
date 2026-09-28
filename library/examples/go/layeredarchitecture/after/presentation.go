package after

import (
	"errors"
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

// CancelOrderUseCase is what the handler depends on: the application layer,
// not any one implementation.
type CancelOrderUseCase interface {
	Execute(orderID int) error
}

// HandleCancelRequest is the presentation layer: parse the request into a
// command, call the use case, shape a response.
func HandleCancelRequest(request CancelRequest, useCase CancelOrderUseCase) CancelResponse {
	orderID, err := strconv.Atoi(request.OrderID)
	if err != nil {
		return CancelResponse{"invalid", "order id must be a number"}
	}

	switch err := useCase.Execute(orderID); {
	case errors.Is(err, ErrOrderNotFound):
		return CancelResponse{"not_found", fmt.Sprintf("order %d not found", orderID)}
	case errors.Is(err, ErrOrderCannotBeCancelled):
		return CancelResponse{"rejected", err.Error()}
	case err != nil:
		panic(err) // an unmapped storage failure isn't a business outcome
	default:
		return CancelResponse{"ok", fmt.Sprintf("order %d cancelled", orderID)}
	}
}
