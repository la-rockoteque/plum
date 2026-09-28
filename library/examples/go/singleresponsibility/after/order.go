package after

type OrderStatus string

const (
	Pending   OrderStatus = "pending"
	Shipped   OrderStatus = "shipped"
	Cancelled OrderStatus = "cancelled"
)

type Order struct {
	ID            int
	CustomerName  string
	CustomerEmail string
	Status        OrderStatus
}
