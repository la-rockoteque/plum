# CQRS — Command Query Responsibility Segregation

> Write through a model that owns behaviour. Read through a model shaped for the screen.

## The problem

One model serves both jobs. A method changes state *and* returns the domain entity to a caller that only wants
display data. The UI now depends on the write model's shape; read needs (joins, derived flags, formatting) start
bending domain classes; list screens load whole aggregates to show three fields.

## The idea

Split the **model**, not just the method names:

| Side | Handler | Model | Responsibility |
|---|---|---|---|
| Command | change something | behaviour-rich entity | enforce invariants, persist state |
| Query | fetch something | plain read model / DTO | return exactly what the consumer displays, including derived fields |

The read model has no behaviour; the query port has no `save`. A storage-backed reader projects display fields
directly, without constructing the entity.

```text
Command ──► Entity.behaviour() ──► RepositoryPort ──► shared store ◄── ReaderPort ◄── Query ──► ReadModel
```

## CQS vs CQRS

**CQS** (method level): a method either changes state or returns data. **CQRS** (architecture level): reads and
writes get *distinct models and contracts*. Renaming methods to `CommandHandler`/`QueryHandler` is not CQRS.
Commands may still read to validate and may return IDs or acknowledgements.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Command handler | `CancelOrder` | Mutating endpoints/services |
| Write model | `Order` | Entities with rules |
| Read model | `OrderSummary` (id, status text, `can_cancel`) | Response DTOs, view models, GraphQL types |
| Query port | `OrderSummaryReader` | Read-only data access |
| Projection | SQL reader selecting fields directly | Queries that build responses without hydrating entities |

## Walk the stages

1. **before** — the mixed method returns the entity.
2. **after** — find the read model and its derived field, the query handler and its port, then note the command
   path is *unchanged*. Compare the in-memory reader (projects from the repository snapshot) with the SQL
   reader (projects straight from the table).
3. Run the demo: query → command → query. The first summary is a snapshot; it doesn't update itself.

## What CQRS does not require

Two databases · event sourcing · queues or async commands · eventual consistency · a mediator framework.
This example is single-store and synchronous. Separate read stores make sense when read workloads or shapes
diverge sharply — and bring projection updates, recovery and lag with them.

## Consistency

A read model is a snapshot. `can_cancel` is a **display hint**, not authorization: the command must still
validate against current state, and clients must handle a rejected command.

## When not to

For straightforward CRUD a shared model is simpler. CQRS earns its cost when write rules and read/reporting
needs evolve independently.
