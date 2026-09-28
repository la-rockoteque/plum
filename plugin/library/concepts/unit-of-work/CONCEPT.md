# Unit of Work

> One business operation, one commit. If any part fails, none of it happened.

## The problem

Cancel two things as one operation. With a save-per-call repository, the first save commits immediately; when
the second fails, the database is left half-changed.

## The idea

Open one scope around **every read, domain call and write** of the operation. Writes inside it may be
*flushed* (SQL sent) but stay uncommitted until the scope succeeds; any error rolls everything back.

```text
begin
  load A ─► A.cancel() ─► write A   (flushed, not committed)
  load B ─► B.cancel() ─► 💥
rollback  → A is untouched
```

ORM sessions (SQLAlchemy Session, EF Core DbContext, Exposed transaction) *are* units of work: they track
changes and own commit/rollback. No extra `IUnitOfWork` framework is needed to get the behaviour.

## Roles — find them in any codebase

| Role | What to look for |
|---|---|
| Business operation | Handlers that change several aggregates or rows |
| Unit of work | `transaction { }`, `session.begin()`, `BeginTransaction`, `db.Transaction(func(tx))`, `@Transactional` |
| Flush vs commit | `flush()` / `SaveChanges()` vs the outer commit |
| Leaky scope | repositories that open and commit their own transaction per call |

## Walk the stages

1. **before** — each cancellation saves on its own; run the demo and see `cancelled, pending`.
2. **after** — find the outer transaction; confirm reads, domain calls and writes are inside it. Find the first
   write and note it is not yet permanent. Run the demo: rollback leaves `pending, pending`; commit gives
   `cancelled, cancelled`.
3. Read the failure tests: a missing ID and a duplicate ID both fail *after* a write. The duplicate proves the
   second read sees the first change within the transaction.

## Rules that keep it correct

- Let errors **leave** the scope. Catching inside an auto-committing callback can commit partial work.
- Keep scopes short and local to one operation.
- Rollback restores database state, not in-memory objects the caller still holds.
- A DB transaction cannot undo an email, a payment API call or a published message. Use an **outbox** (or a
  saga) for those effects.
- This does not solve concurrent lost updates between separate operations; that needs optimistic versioning or
  locking.

## Design choice

The examples are deliberately infrastructure-aware batch coordinators. If a use case must stay storage-free,
introduce an application-owned transaction port (`runInTransaction(fn)`) implemented by the adapter layer.
