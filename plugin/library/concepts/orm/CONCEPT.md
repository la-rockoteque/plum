# ORMs — mapping objects to relational storage

> An ORM is an adapter technology. It maps rows and generates SQL; it doesn't define your boundary.

## The idea

An **Object–Relational Mapper** maps language objects/records to tables and generates SQL for loading,
inserting and updating. Here the same repository port is implemented twice — raw SQL, then ORM — so you can
compare them line for line. The use case and domain are untouched.

```text
UseCase ──► RepositoryPort ◄── ORM adapter ──► ORM ──► DB
                    ▲
                    └───────── raw-SQL adapter
```

| Concept | Its job |
|---|---|
| ORM | map persistence data, generate SQL, (often) track changes |
| Repository | offer the application's domain-shaped boundary |
| Dependency injection | hand the chosen adapter to the use case |
| CQRS | lets reads bypass entities entirely |

An ORM doesn't *require* a custom repository; many apps use its API directly. The repository is kept here to
show replaceability and keep business tests database-free.

## ORM styles

Session/unit-of-work ORMs (SQLAlchemy, EF Core, Hibernate/Exposed DAO) track entity state inside a session,
context or transaction. SQL-builder ORMs (Drizzle, jOOQ, Kysely) stay close to SQL with no identity map. Active
Record-style (GORM, ActiveRecord, Eloquent) persists through explicit calls on mapped structs/objects.

## Roles — find them in any codebase

| Role | What to look for |
|---|---|
| Persistence model (`OrderRow`) | Classes with table/column annotations or schema definitions |
| Domain object (`Order`) | Should *not* carry ORM annotations if the domain is meant to be storage-free |
| Adapter | Code converting between the two |
| Lifetime scope | Where sessions/contexts are opened and closed — per request, per call, or (danger) global |

## Walk the stages

1. **before** — raw SQL and manual row mapping.
2. **after** — find table name, primary key and status column in the mapping; follow `get` (load row → validate
   → return plain domain object) and `save` (insert or update).
3. Run with SQL logging. Count round trips; some adapters select-then-write, others upsert.

## Things that bite

- **Detached snapshots.** Mutating a returned domain object persists nothing; the ORM tracks *its* rows, not
  your domain object.
- **Lifetime.** Short scopes are predictable but may add reads. Sharing a scope across operations is an explicit
  atomicity design (see `unit-of-work`), never a global context.
- **N+1 queries.** Lazily loading a relation per item in a list turns one query into N+1. Inspect SQL; use joins,
  eager loading or a projection.
- **Schema creation ≠ migrations.** `create_all`/`EnsureCreated`/`AutoMigrate` are for disposable databases.
  Production needs reviewed, versioned migrations and a data plan.
- Parameterize raw SQL. Database constraints still protect data; domain rules still live in the domain.

## When not to

For a tiny table raw SQL is perfectly reasonable. The lesson is knowing what the ORM does, where its lifetime
ends, and how to read the SQL it generates.
