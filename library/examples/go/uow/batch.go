package uow

import (
	"example.com/repository-example/application"
	"example.com/repository-example/orm"
	"gorm.io/gorm"
)

func CancelOrders(db *gorm.DB, orderIDs []int) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Use tx, not db: every save must join this unit's transaction.
		cancel := application.NewCancelOrder(orm.NewOrderRepository(tx))
		for _, id := range orderIDs {
			if err := cancel.Execute(id); err != nil {
				return err
			}
		}
		return nil // GORM commits on nil; an error rolls back and propagates.
	})
}
