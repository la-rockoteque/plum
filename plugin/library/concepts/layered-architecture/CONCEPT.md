# Layered architecture

> Presentation, application, domain and data are different concerns. Give each its own place, and each earns its own test.

## The problem

A use case that starts life as "handle this request" tends to grow into one function: parse the input, validate it,
apply the business rule, and talk to storage — all in the same place. That function reads fine the day it's
written. Then:

- **A rule change and a schema change both land in the same diff.** Renaming a column and tightening a business
  rule touch the identical lines, even though nothing connects them except proximity.
- **Testing the rule needs everything else.** To prove "a shipped order can't be cancelled" you must first build a
  request object and stand up a database, because the rule is inseparable from parsing and persistence.
- **Nothing here is reusable.** A second entry point (a CLI, a background job) means copying the whole function,
  rule and all.

## The idea

Separate the concern of *shape* (what a request/response looks like), *behaviour* (what changing an order means)
and *storage* (how an order is kept), and let each depend only on the layer beneath it:

```text
Presentation ───► Application ───► Domain
                        ▲
                        └── Data (implements the application's repository port)
```

- **Presentation** turns a raw request into a validated command, calls the application layer, and turns the
  outcome into a response. It never sees SQL.
- **Application** is a thin orchestrator: load the aggregate, call its behaviour, save it. It owns the port the
  data layer implements (see `dependency-inversion`).
- **Domain** is the aggregate itself — the one place the business rule lives, with no request and no database in
  sight.
- **Data** adapts the application's port to a real store (and, for tests, to memory).

The use case is unchanged in *what* it does; it's now four small things instead of one entangled one, and each is
readable, testable, and changeable without touching its neighbours.

## Roles — find them in any codebase

| Role | In the canonical example | What to look for in a real repo |
|---|---|---|
| Presentation | `handleCancelRequest` | A controller action, HTTP handler, or CLI command that parses input |
| Request / response | `CancelRequest` / `CancelResponse` | DTOs, view models, or "the shape the API returns" |
| Application service | `CancelOrder` | A use case, interactor, or application service class |
| Domain behaviour | `Order.cancel()` | The method (or its absence) that should own the invariant |
| Port | `OrderRepository` | An interface near the use cases — or SQL where one should be |
| Data adapter | `SqliteOrderRepository`, `InMemoryOrderRepository` | Classes importing a DB driver, ORM or HTTP client |

## Walk the stages

1. **Before — coupled.** Read the single function: parsing, the rule, and SQL share one scope. Its only test has
   to build a request record *and* a database before it can assert anything about the business rule.
2. **After — layered.** Read the domain file first (no imports beyond the language's standard library) — this is
   the rule, in isolation. Then the application service (three lines of intent), then the data adapters, then the
   presentation handler. Notice what each layer's test needs: the domain test needs neither a request nor a
   database; the application test needs an in-memory repository; the handler test needs a fake application
   service; only the last test exercises all four layers together, on SQLite.

## Trade-offs / when not to

For a thin CRUD screen where "the rule" is just "is this field present," one function is simpler and the layers
add files without adding safety. Layering earns its cost when a rule is worth testing in isolation, when more than
one entry point will call the same behaviour, or when storage is likely to change under the application.

**Strict vs. relaxed layering.** In strict layering, each layer only ever calls the layer directly below it. Most
real systems relax this — the domain never calls up into presentation, but a thin pass-through layer is sometimes
skipped. What must not be relaxed is the *direction*: nothing below should import or know about the layer above
it. The data layer here doesn't know `CancelOrder` exists; it only knows the port.

**The anemic service layer risk.** It's tempting to let the application service *also* hold the business rule,
leaving the domain object as a plain data holder (fields, no behaviour). That inverts the design: the layer meant
to orchestrate ends up owning the invariant, and the one place a reader expects to find "what does cancel mean"
is empty. Keep the rule on the aggregate; keep the service down to load → call → save.

**Why the application owns the port.** The repository interface lives with the code that needs persistence, not
with the code that provides it — the same direction `dependency-inversion` argues for. The data layer depends on
the application's contract; the application never imports the data layer.

## Common misconceptions

- "Layers means files in folders named `presentation/`, `application/`, etc." The names help navigation, but the
  lesson is the *dependency direction*, not the directory structure.
- "More layers is always more professional." Layering is a cost paid for a benefit (isolated testing, swappable
  storage, multiple entry points). Where none of those apply, it's overhead.
- "The application layer is just glue, so it doesn't need care." An application service with no logic at all is a
  smell in the other direction — see the anemic service layer above.

## Exercise

Add a second entry point — a small CLI command that cancels an order by ID — reusing the existing application
service and repository port without touching the domain or data layers.

## References

- Martin Fowler, [Presentation Domain Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
