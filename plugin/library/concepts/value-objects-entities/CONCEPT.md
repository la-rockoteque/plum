# Value Objects and Entities

> A value object is *what* it holds; an entity is *which one* it is.

## The problem

A domain model built entirely from primitives — a status typed as a bare string, an amount typed as a bare
number — has no way to refuse nonsense. A typo like `"procesed"` is just as acceptable as `"pending"`. A
cancelled order can be nudged back to pending with a single assignment. An amount in dollars and an amount in
euros add up to a number that means nothing. A repeated float addition drifts away from the exact total it
should be. None of this throws — the bugs live quietly in production until someone notices the ledger is wrong.

## The idea

Split every domain concept into one of two kinds:

- A **value object** is defined entirely by its attributes. Two value objects with the same attributes *are*
  the same value — there is no identity to tell them apart, and no reason to let them change in place. It also
  gets to enforce its own rules: which states exist, which arithmetic is even meaningful.
- An **entity** is defined by an identity that outlives its attributes. Two entities with identical attributes
  but different ids are different things; the same entity is still "itself" after its status changes ten times.

```text
before:  Order { status: string, total: number, currency: string }   — one bag of primitives, no rules
after:   Order { id, status: OrderStatus, total: Money }             — entity (id) + value objects (status, money)
```

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Entity | `Order` | A type with an id that must persist through change; compared by id, not by structure |
| Value object (state) | `OrderStatus` | A closed set of legal states plus the legal moves between them |
| Value object (quantity) | `Money` | An amount tied to a unit/currency, immutable, compared by value |
| Naive primitive | `status: string`, `total: number` | Any field that *should* carry rules but is typed as a bare primitive |
| Rejected operation | `OrderStatus.parse`, `Money.add` | The point where an invalid state or a nonsensical operation is refused |

## Walk the stages

1. **before** — `Order` is a plain bag of primitive fields. Nothing stops `status` from holding a value nobody
   defined, or from moving from `"cancelled"` back to `"pending"`. `total` and `currency` are separate fields, so
   adding two orders' totals silently ignores whether the currencies match, and repeated float addition drifts
   (`0.1 + 0.1 + 0.1 != 0.3` in IEEE‑754 binary floating point).
2. **after** — `OrderStatus` becomes a value object: it can only be one of its legal states (`pending`, `shipped`,
   `cancelled`), and only `pending → shipped` and `pending → cancelled` are allowed — a shipped or cancelled order
   can't be cancelled again, and neither can move back to `pending`. Parsing an unrecognized string is rejected
   at the boundary with its own error (`UnknownStatus`), kept distinct from an illegal transition between two
   *known* states (`InvalidStatusTransition`) — "this word isn't a status" and "you can't get there from here"
   are different mistakes. `Order` only exposes `status` for reading; the sole way to change it is `ship()` /
   `cancel()`, so a caller can't reach in and reset it directly the way the `before` stage's bare field allowed.
   `Money` becomes a value object: immutable, storing an integer amount in the currency's minor unit (so repeated
   addition never drifts), refusing to add across currencies, and equal to another `Money` whenever the amount
   and currency match. `Order` stays a plain entity: its equality is based on `id` alone, so two different orders
   with identical status and total are still different orders, and the same order is still equal to itself after
   its status changes — unlike the `before` stage, where comparing bare structs/records/dataclasses by value makes
   the same order look like a different one the moment its status changes.

## Trade-offs / when not to

Wrapping every primitive costs a type and, in some languages, a few lines of boilerplate. It pays off exactly
when a primitive is carrying a rule — a fixed set of states, a unit, an invariant — that would otherwise be
re-validated (or not validated at all) everywhere it's used. A `total: number` that never has a currency, or a
`status` with no legal-transition rule, doesn't need this; not every primitive is secretly a value object.

## Common misconceptions

- "Value objects are just DTOs." A DTO is a transport shape with no behavior; a value object owns rules
  (parsing, equality, refusing invalid operations) as part of its type.
- "Immutable means read-only in the UI sense." It means an operation like `add` never changes its operands — it
  returns a new value. The *type* enforces this, not caller discipline.
- "Entities can't have value objects as fields." They should — an entity's *identity* is what's compared;
  its attributes, including value objects like `Money`, are free to be rich types.
- "Overriding equality on an entity is optional." Without it, most languages default to structural or reference
  equality, neither of which matches "same id, different attributes over time."

## References

- Vernon, [Effective Aggregate Design](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf)
- Fowler, [ValueObject](https://martinfowler.com/bliki/ValueObject.html)
- Fowler, [EvansClassification](https://martinfowler.com/bliki/EvansClassification.html)
