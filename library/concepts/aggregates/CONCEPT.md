# Aggregates and consistency boundaries

> An invariant that spans several objects needs one door they all sit behind — not a lock on each of them.

## The problem

A rule like "the total equals the sum of the lines," "at most 10 lines," or "a cancelled order can't be
changed" isn't about one object — it's about a *cluster* of objects taken together. If each object in that
cluster can be reached and changed on its own — its own repository, its own collection, its own setter — the
rule has no single place to live. Every caller that touches a line has to remember the rule, re-check it, and
keep some cached summary in sync by hand. Some of them won't. The header row drifts out of sync with its
children, a collection grows past the limit nobody enforced, and a "cancelled" record keeps quietly accepting
edits, because nothing was ever asked permission.

## The idea

Group the objects that share an invariant into one **aggregate**, and give it exactly one **root** — the only
object reachable from outside the cluster. Every read or write to anything inside goes through the root's
methods; nothing inside is exposed for outside code to hold onto and mutate. The root checks every invariant
that spans its members before it lets a change happen, so "sum of the lines," "at most N of them," and "not
after cancelled" are enforced in one place instead of hoped for everywhere. Persistence follows the same
boundary: **one repository loads and saves a whole aggregate**, never a piece of one.

```text
before:  Order { totalMinor (cached) } ── OrderLine ←── OrderLineRepository ←── any caller
                                              ↑ reachable and mutable directly, rule lives nowhere

after:   caller ──► Order (root: addLine, changeQuantity, removeLine, cancel) ──► OrderLine (internal, copies only)
                          ▲
                          └── OrderRepository (loads/saves the whole Order)
```

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Aggregate root | `Order` | The one type with a repository; every mutation is one of its named methods |
| Internal member | `OrderLine` | An entity/value with no repository of its own, unreachable except through the root |
| Cross-member invariant | "total = sum of lines," "≤ 10 lines," "quantity ≥ 1" | A rule that mentions more than one child, or the collection as a whole |
| Leaking boundary | a child with its own repository/collection, a getter returning the live list | The thing this concept's `before` stage is built from |
| One repository per aggregate | `OrderRepository` | A repository whose `get`/`save` type is the root, never a child entity |

## Walk the stages

1. **before** — `OrderLine` has its own repository, so a caller can `add` an 11th line, `updateQuantity` a line
   to zero, or edit a line on a cancelled order — all without going near `Order`. `Order.totalMinor` is a plain
   cached field: correct right after someone calls `recomputeTotal`, and stale the moment any line changes after
   that, because nothing ties the two together.
2. **after** — `Order` is the aggregate root: `addLine`, `changeQuantity`, `removeLine` and `cancel` are the only
   ways in, and each checks every invariant that matters (not cancelled, quantity ≥ 1, at most 10 lines) before
   it changes anything. `totalMinor` is a computed property, derived from the current lines on every read, so it
   can never go stale. The `lines` getter returns copies, so a caller who fetches a line and mutates it changes
   nothing about the order. One `OrderRepository` saves and loads the `Order` as a whole — there is no repository
   for a line by itself.

## Trade-offs / when not to

Aggregates cost indirection: every change goes through the root's API instead of a direct setter, and the root
has to expose enough operations to be useful without exposing its internals. That's wasted ceremony when nothing
actually spans more than one object — a truly independent child (its own lifecycle, no invariant shared with a
parent) is its own aggregate, not a "member" forced under someone else's root. The size of an aggregate is a
design decision on its own: small aggregates (Evans/Vernon's advice) keep locks and transactions cheap; one
aggregate reaching across a whole object graph just relocates the original problem to a bigger boundary.

## Common misconceptions

- "An aggregate is just an entity with child objects." It's specifically the objects that share a *consistency
  rule* — grouping things because they're related in a diagram, not because they share an invariant, produces
  an aggregate that's too big.
- "Bigger aggregates are safer." The opposite: every aggregate is loaded, locked and saved as one unit (see
  `unit-of-work`), so a bigger boundary means more contention and bigger transactions for rules that didn't need
  to be coupled.
- "Other aggregates can hold a reference to this one's internals." They reference the *root*, by id, and go
  through its API like anyone else — never by holding a pointer to one of its members.
- "Aggregate boundaries should match the UI's screens." A screen groups what's convenient to *show*; an
  aggregate groups what must stay *consistent*. The two often disagree, and the invariant wins.

## References

- Vernon, [Effective Aggregate Design](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf)
- Fowler, [DDD_Aggregate](https://martinfowler.com/bliki/DDD_Aggregate.html)
