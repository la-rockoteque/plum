# C# / .NET

Requires the .NET 10 SDK. From this directory:

```sh
dotnet test RepositoryExample.Tests
dotnet run --project RepositoryExample -- memory
dotnet run --project RepositoryExample -- sqlite
```

Both demos print `Order 1: cancelled`. SQLite runs in memory and closes on exit.

Read `BeforeRepository.cs`, then `Domain/Order.cs`, `Application/IOrderRepository.cs`,
and `Application/CancelOrder.cs` under `RepositoryExample/`. Compare the two
`Infrastructure/` adapters; `Program.cs` wires them to the same demonstration.

C# explicitly implements `IOrderRepository`; nullable `Order?` represents a missing
order. Domain and application errors use exceptions. Application tests use the
dictionary adapter; integration tests exercise both adapters' storage contract.

[Microsoft.Data.Sqlite](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/)
provides raw SQL access without an ORM. The caller owns an open connection; writes
autocommit one statement at a time. Use a dedicated connection without an enclosing
transaction. Read/cancel/save is not atomic across concurrent writers.

See the [main walkthrough](../../README.md) for dependency direction and trade-offs.

## Dependency Injection and Dependency Inversion

```sh
dotnet run --project RepositoryExample -- di before
dotnet run --project RepositoryExample -- di injection
dotnet run --project RepositoryExample -- di console
dotnet run --project RepositoryExample -- di recording
```

Read `RepositoryExample/DependencyInjection/` in this order: `Before.cs`,
`InjectionOnly.cs`, `Application.cs`, `Infrastructure.cs`, `Demo.cs`.
`dotnet test RepositoryExample.Tests` includes this batch's tests.
See the [DI/DIP walkthrough](../../docs/dependency-injection.md) for the distinction.

## CQRS

```sh
dotnet run --project RepositoryExample -- cqrs before
dotnet run --project RepositoryExample -- cqrs memory
dotnet run --project RepositoryExample -- cqrs sqlite
```

Read `RepositoryExample/Cqrs/`: the before service, query contract and summary,
then the readers and demo. The write side reuses the original `CancelOrder`.
`dotnet test RepositoryExample.Tests` includes unit and integration tests.
See the [CQRS walkthrough](../../docs/cqrs.md).

## ORMs

```sh
dotnet test RepositoryExample.Tests
dotnet run --project RepositoryExample -- orm raw
dotnet run --project RepositoryExample -- orm orm
dotnet run --project RepositoryExample -- orm sql
```

Restore now includes EF Core's SQLite provider. Read `RepositoryExample/Orm/`:
the row/context mapping, repository adapter, then demo. `sql` prints generated
SQL. See the [ORM walkthrough](../../docs/orms.md).

## Unit of Work

```sh
dotnet run --project RepositoryExample -- uow
```

Runs three checked scenarios: partial saves before adding a transaction, rollback
after a missing order, and a successful two-order commit. Uses the existing ORM
dependencies. See the [shared walkthrough](../../docs/unit-of-work.md) for
transaction ownership, flush versus commit, and implementation links.
