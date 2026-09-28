package after

import "database/sql"

// InMemoryOrderRepository is a data-layer adapter for tests and demos: same
// contract, no database.
type InMemoryOrderRepository struct {
	orders map[int]Order
}

func NewInMemoryOrderRepository() *InMemoryOrderRepository {
	return &InMemoryOrderRepository{orders: make(map[int]Order)}
}

func (r *InMemoryOrderRepository) Get(orderID int) (*Order, error) {
	order, ok := r.orders[orderID]
	if !ok {
		return nil, nil
	}
	return &order, nil
}

func (r *InMemoryOrderRepository) Save(order Order) error {
	r.orders[order.ID] = order
	return nil
}

func InitializeSchema(db *sql.DB) error {
	_, err := db.Exec("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, status TEXT NOT NULL)")
	return err
}

// SqliteOrderRepository is a data-layer adapter over SQLite. Caller owns db.
type SqliteOrderRepository struct {
	db *sql.DB
}

func NewSqliteOrderRepository(db *sql.DB) *SqliteOrderRepository {
	return &SqliteOrderRepository{db: db}
}

func (r *SqliteOrderRepository) Get(orderID int) (*Order, error) {
	var order Order
	err := r.db.QueryRow("SELECT id, status FROM orders WHERE id = ?", orderID).
		Scan(&order.ID, &order.Status)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *SqliteOrderRepository) Save(order Order) error {
	_, err := r.db.Exec(
		"INSERT INTO orders (id, status) VALUES (?, ?) "+
			"ON CONFLICT(id) DO UPDATE SET status = excluded.status",
		order.ID, order.Status,
	)
	return err
}
