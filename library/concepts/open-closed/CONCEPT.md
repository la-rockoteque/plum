# Open–Closed Principle

> Software entities should be open for extension, but closed for modification.

## The problem

A fee calculator branches on an order's type: standard orders are free to cancel while still pending, express
orders pay a flat fee, custom-made orders pay a percentage, subscriptions pay a prorated amount. That switch
statement is easy to write and easy to read — until a second piece of code needs the same distinction. A
refund-description builder, producing the customer-facing message, also has to know which order type it's looking
at, so it grows its own switch on the same field. The two switches start in sync. Then a new order type is added
to the business, the fee switch is updated because that's where the bug report pointed, and the second switch is
forgotten — not because anyone was careless, but because nothing connects the two files. The order type that
"just needs one more case" quietly needs it in every place that ever branched on it, and there's no compiler error
or failing build to say which places those are.

## The idea

Bertrand Meyer's original formulation asked for extension without modifying the *source* at all — achieved
through inheritance, subclassing a base class to add behavior. Robert C. Martin's later, now more common, reading
relaxes this: a module can be extended by *plugging in* a new implementation of a small interface, without editing
the module itself. "Closed" doesn't mean "never touched again forever" — it means the *existing* callers,
switches, and classes that already handle the known cases don't need to change shape when one more case shows up.
Concretely: replace the type switch with a small interface (one policy per type) and a lookup keyed by type. The
calculator that used to ask "which type is this, and what do I do for it?" now just asks the map for the right
policy and delegates. Adding a type means writing one new class and registering it — every existing policy,
and the calculator itself, is unchanged.

```text
before:  CancellationFeeCalculator --switch(type)--> fee
         RefundDescription        --switch(type)--> text     # same type, two switches, drifts silently

after:   type -> policy map -> FeePolicy.fee(order)
                             -> FeePolicy.describeRefund(order)
         (a new type = a new policy in the map; no existing file is edited)
```

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| The duplicated switch | `CancellationFeeCalculator` (before) | A conditional or `switch` keyed on a type/kind/status field |
| The drifted twin | `RefundDescription` (before) | A second, independently-maintained switch on the same field, in a different file |
| The extension point | `FeePolicy` | A small interface with one method per behavior that varies by type |
| One implementation per case | `StandardFeePolicy`, `ExpressFeePolicy`, ... | A class per type, each holding only that type's logic |
| The place variation is chosen | `CancellationFeeCalculator` (after) | A map/registry from type to implementation, looked up once |

## Walk the stages

1. **before** — `CancellationFeeCalculator.calculateFee` branches on `order.type` and gets every case right,
   including custom-made orders. `RefundDescription.describe` branches on the same field but was never updated
   for custom-made orders: it falls through to a generic message. The fee is correct; the refund description the
   customer actually reads is wrong. Nothing crashed, nothing failed a type check — the two switches simply
   went out of sync, because "same field, two files" isn't a relationship any tool enforces.
2. **after** — `FeePolicy` declares `fee` and `describeRefund` together, so a type's fee logic and its refund
   message live in one class and can't drift apart. `CancellationFeeCalculator` holds a map from type to policy
   and only ever calls through it. The test that adds a `gift` policy defines one new class implementing
   `FeePolicy`, adds one entry to a copy of the map, and calls the existing calculator — no existing policy
   class, and no line of `CancellationFeeCalculator`, changes.

## Trade-offs / when not to

An interface and a map are more moving parts than an `if`/`switch` chain, and they cost something: one more file
per case, one more level of indirection to follow when reading the code. That cost is worth paying once a second
variant of the same behavior actually exists and a third is plausible — not before. A calculator with a single
order type and no second type in sight doesn't need a `FeePolicy` interface; it needs the straightforward
conditional, or no conditional at all. Building the extension point before there's a second real case to extend it
with is guessing at a shape you don't have evidence for, and the guess is often wrong: the map, the interface, and
the naming all get designed around one example.

## Common misconceptions

- **"Closed for modification" means the code is frozen.** It means the *existing* cases don't need to change to
  accommodate a new one. Bugs still get fixed, the interface itself can still evolve when a genuinely new kind of
  variation appears — "closed" describes what a new *case* costs, not what the whole module costs forever.
- **Any `if`/`switch` is an OCP violation.** A switch that will only ever have the cases it has today, with no
  business reason to expect a new one, is just a conditional — the cost of an interface and a registry buys
  nothing if there's nothing to plug in.
- **Open-closed always means inheritance.** Meyer's original version did lean on subclassing; the version most
  teams practice today — and the one this concept teaches — uses composition: implement a small interface
  and hand the implementation to the collaborator that needs it, rather than subclassing that collaborator.

## References

- [Open–closed principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle) — Wikipedia
  overview, including Meyer's original formulation and Martin's polymorphic refinement.
- Robert C. Martin, ["The Open Closed Principle"](https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html) —
  the "closed for modification, open for extension through polymorphism" framing this narrative follows.
