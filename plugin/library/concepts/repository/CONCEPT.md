# Repository Pattern

> The application asks for *aggregates*, not rows. Storage is an adapter detail.

## The problem

A use case that loads data, checks a business rule and writes the result back usually starts life as one
function. SQL (or ORM calls, or HTTP calls to a storage service), table and column names, and the rule itself
all sit together. Two things follow:

- **Every change to storage touches business code.** Renaming a column, switching drivers or caching reads
  means editing the use case.
- **Every business-rule test needs the store.** You cannot check "a cancelled thing can't be cancelled twice"
  without a database, fixtures and cleanup.

## The idea

Give the application a **port**: a tiny contract, owned by the application, phrased in domain terms.
In the canonical example it has two operations:

- `get(id)` → a *detached* aggregate, or "not found"
- `save(aggregate)` → insert or update by identity

The use case becomes: load → call domain behaviour → save. Every storage concern — queries, mapping, status
strings to enums, connection lifetime — moves into **adapters** that implement the port. An in-memory adapter
honouring the same contract makes business tests database-free.

```text
UseCase ───► RepositoryPort ◄─── StorageAdapter ───► real store
                  ▲
                  └──────────── InMemoryAdapter (tests, demos)
```

Source dependencies point **inward**: the adapter knows the port; the port knows nothing about the adapter.

## Roles — find them in any codebase

| Role | In the canonical example | What to look for in a real repo |
|---|---|---|
| Aggregate / entity | `Order` with `cancel()` | The noun whose state changes under a rule (Invoice, Booking, Subscription, Ticket…) |
| Domain behaviour | `Order.cancel()` raising "already cancelled" | The method (or the missing method!) that should own the invariant |
| Port | `OrderRepository` (`get`, `save`) | An interface near the use cases — or its absence |
| Use case | `CancelOrder` | Service/handler/controller method performing one business action |
| Adapter | `SqliteOrderRepository` | Classes importing the DB driver/ORM/SDK |
| Test adapter | `InMemoryOrderRepository` | Fakes, or tests that spin up a DB when they shouldn't need to |

## Walk the stages

1. **Before — coupled.** Read the before file: query, rule and update in one function. Note its test needs a
   database. Name every piece of storage vocabulary in it.
2. **After — port + adapters.** Read the port (two methods, no SQL crosses it), the use case (three lines of
   intent), then the two adapters. Run the demo in both modes: only wiring changes.
3. **Compare the tests.** Use-case tests run on the in-memory adapter. Contract tests run the *same* storage
   checks against both adapters, so the fake can't drift from reality.

## Design details that matter

- **Detached copies.** Adapters copy on read and write, so mutating a loaded object persists nothing until
  `save()`. The in-memory adapter must behave the same, or tests lie.
- **Collection-like, not table-like.** A repository is shaped by what the application needs, not by CRUD over
  every column. Generic `Repository<T>` with 15 methods is usually a smell.
- **One repository per aggregate**, not per table.
- **Not a transaction.** `get → cancel → save` is several operations; concurrent writers are not handled.
  See `unit-of-work` and optimistic versioning.

## When not to

For thin CRUD where the "rules" are validation the framework already does, direct data access is fine. The
pattern costs files, mapping code and a contract to maintain. It earns them when business behaviour must be
tested without storage, or when more than one persistence implementation is genuinely needed.

## Common misconceptions

- "A repository is just a DAO." A DAO mirrors tables; a repository mirrors the application's needs.
- "Using an ORM means I already have repositories." The ORM is an adapter technology (see `orm`).
- "The interface belongs with the implementation." It belongs with the code that *uses* it (see
  `dependency-inversion`).

## Exercise

Add a JSON-file adapter without changing the use case. Make it pass the existing contract tests.
