package application

import "example.com/repository-example/domain"

// Get returns a detached entity, or nil for an unknown ID.
// Save inserts or updates by ID. Storage failures are returned as errors.
type OrderRepository interface {
	Get(orderID int) (*domain.Order, error)
	Save(order domain.Order) error
}
