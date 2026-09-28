package before

// OrderLine is a line entity with its own identity — nothing stops a caller reaching it directly.
type OrderLine struct {
	ID             int
	OrderID        int
	SKU            string
	Quantity       int
	UnitPriceMinor int
	Currency       string
}

// OrderLineRepository gives lines their own repository/collection, so callers can bypass the order entirely.
type OrderLineRepository struct {
	lines map[int]*OrderLine
}

func NewOrderLineRepository() *OrderLineRepository {
	return &OrderLineRepository{lines: make(map[int]*OrderLine)}
}

func (r *OrderLineRepository) Add(line *OrderLine) {
	r.lines[line.ID] = line
}

func (r *OrderLineRepository) UpdateQuantity(lineID int, quantity int) {
	r.lines[lineID].Quantity = quantity
}

func (r *OrderLineRepository) Remove(lineID int) {
	delete(r.lines, lineID)
}

func (r *OrderLineRepository) ForOrder(orderID int) []*OrderLine {
	var result []*OrderLine
	for _, line := range r.lines {
		if line.OrderID == orderID {
			result = append(result, line)
		}
	}
	return result
}

// Order's TotalMinor is a cache: correct only if every caller remembers to refresh it.
type Order struct {
	ID         int
	Status     string
	TotalMinor int
	Currency   string
}

func NewOrder(id int) *Order {
	return &Order{ID: id, Status: "pending", Currency: "USD"}
}

// RecomputeTotal refreshes the cached total from the current lines — easy to forget to call.
func RecomputeTotal(order *Order, lines []*OrderLine) {
	total := 0
	for _, line := range lines {
		total += line.Quantity * line.UnitPriceMinor
	}
	order.TotalMinor = total
}
