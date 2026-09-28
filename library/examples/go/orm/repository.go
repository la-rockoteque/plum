package orm

import (
	"database/sql"
	"errors"
	"fmt"

	"example.com/repository-example/domain"
	gormsqlite "gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type OrderRow struct {
	ID     int    `gorm:"column:id;primaryKey;autoIncrement:false"`
	Status string `gorm:"column:status;not null"`
}

func (OrderRow) TableName() string { return "orders" }

// Open reuses the caller's database/sql connection and existing SQLite driver.
func Open(connection *sql.DB, logSQL bool) (*gorm.DB, error) {
	level := logger.Silent
	if logSQL {
		level = logger.Info
	}
	return gorm.Open(gormsqlite.New(gormsqlite.Config{Conn: connection}), &gorm.Config{
		Logger: logger.Default.LogMode(level),
	})
}

type OrderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) OrderRepository { return OrderRepository{db: db} }

func (r OrderRepository) Get(orderID int) (*domain.Order, error) {
	var row OrderRow
	err := r.db.First(&row, "id = ?", orderID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	status := domain.OrderStatus(row.Status)
	if status != domain.Pending && status != domain.Cancelled {
		return nil, fmt.Errorf("unknown order status: %q", row.Status)
	}
	return &domain.Order{ID: row.ID, Status: status}, nil
}

func (r OrderRepository) Save(order domain.Order) error {
	row := OrderRow{ID: order.ID, Status: string(order.Status)}
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}}, DoUpdates: clause.AssignmentColumns([]string{"status"}),
	}).Create(&row).Error
}
