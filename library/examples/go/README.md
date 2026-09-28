# Go

Requires Go 1.25+. From this directory:

```sh
go test ./...
go run ./cmd/demo memory
go run ./cmd/demo sqlite
```

Both demos print `Order 1: cancelled`. Dependencies download on the first run.

Read `before/before_repository.go`, then `domain/` and `application/`, then
`infrastructure/memory/` and `infrastructure/sqlite/`. `cmd/demo/` selects the
adapter. The consumer owns the interface; Go implementations satisfy it implicitly.
Missing orders return `(nil, nil)`, while storage failures return an error.
The use case propagates those errors; domain and missing-order errors are sentinel
values that callers can inspect with `errors.Is`.

Application tests import only the memory adapter, whose separate package has no
SQLite dependency. Integration tests run the same contract against both adapters.
Order values are copied into the map, so mutating an order still requires `Save`.
Construct orders with an explicit `domain.Pending` status (the zero string isn't
a domain status).

The [modernc SQLite driver](https://pkg.go.dev/modernc.org/sqlite) works through
`database/sql` without a C compiler. The caller closes the database. For `:memory:`,
the demo limits the pool to one connection so all queries see the same database.
Each write autocommits; read/cancel/save is not atomic. The dictionary adapter is
for sequential demonstrations, not concurrent goroutines.

See the [main walkthrough](../../README.md) for dependency direction and trade-offs.

## Dependency Injection and Dependency Inversion

```sh
go run ./cmd/di-demo before
go run ./cmd/di-demo injection
go run ./cmd/di-demo console
go run ./cmd/di-demo recording
```

Read `di/before/`, `di/injectiononly/`, `di/application/`, `di/infrastructure/`,
then `cmd/di-demo/`. `go test ./...` includes this batch's tests.
See the [DI/DIP walkthrough](../../docs/dependency-injection.md) for the distinction.

## CQRS

```sh
go run ./cmd/cqrs-demo before
go run ./cmd/cqrs-demo memory
go run ./cmd/cqrs-demo sqlite
```

Read `cqrs/before/`, `cqrs/queries/`, both readers, then `cmd/cqrs-demo/`.
The command reuses the original `CancelOrder`; queries return detached summaries.
`go test ./...` includes unit and SQLite integration tests.
See the [CQRS walkthrough](../../docs/cqrs.md).

## ORMs

```sh
go test ./...
go run ./cmd/orm-demo raw
go run ./cmd/orm-demo orm
go run ./cmd/orm-demo sql
```

Read `orm/` and `cmd/orm-demo/`. GORM uses the existing `database/sql` connection
backed by modernc SQLite; the caller still closes it. The official GORM dialect
also depends on `go-sqlite3`, but this example doesn't open that driver.
`sql` enables generated-SQL logging. See the [ORM walkthrough](../../docs/orms.md).

## Unit of Work

```sh
go run ./cmd/uow-demo
```

Runs three checked scenarios: partial saves before adding a transaction, rollback
after a missing order, and a successful two-order commit. Uses the existing ORM
dependencies. See the [shared walkthrough](../../docs/unit-of-work.md) for
transaction ownership, flush versus commit, and implementation links.
