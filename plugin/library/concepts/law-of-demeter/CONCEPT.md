# Law of Demeter

> Only talk to your immediate friends: yourself, your parameters, objects you create, and the
> objects you directly hold — never to what one of those hands back to you.

## The problem

Cancelling an order needs two decisions: can the refund happen automatically, and does the
return need a customs form? Both answers come down to the same fact — is this a domestic or an
international order — and both `CancellationPolicy` and `ReturnLabelPrinter` get there the same
way: `order.customer().address().country().code()`. It reads fine, and it works, right up until
the shape at the far end of the chain changes.

Say the business starts grouping countries into customs regions, so a country is no longer
sitting directly on the address — it's one hop further out, behind a `Region`. Nothing about the
refund rule or the labeling rule changed. But both callers had wired themselves directly to the
old path between them and the fact they wanted, not to the fact itself, so both still reach for
`address.country` — which, for a migrated customer, is no longer there. Neither caller crashes;
each already had a defensive fallback for a missing country. So each one silently returns its
own safe-sounding default, and a domestic customer who has been migrated to the new shape gets
told their refund needs manual review and their return needs a customs form neither is true. The
bug isn't a crash to fix in one place — it's two callers that each need to be taught about
`Region`, and a third caller next year will need the same lesson a third time.

This is the **train wreck**: a chain of calls, each one handing back an object the caller then
digs into again, `a.b().c().d()`. The caller ends up knowing the internal structure of objects
it has no direct relationship with — coupling to a shape, not to a responsibility. The cost of
that coupling shows up the moment the shape moves: not as one crash, but as every caller that
walked the chain going quietly wrong at once.

## The idea

The Law of Demeter (originally "only talk to your immediate friends") says a method should call
methods only on: itself, its parameters, objects it creates, and objects it directly holds. It
should not call a method on an object that a *different* call just handed back.

```text
before:  CancellationPolicy ──.address().country().code()──► (reaches two hops past Order)
         ReturnLabelPrinter  ──.address().country().code()──► (the same chain, copied)
         # Region ships: `country` moves behind it. Both copies of the chain now miss,
         # and both callers fall back to their own guess instead of the real answer.

after:   CancellationPolicy ──domestic?──► Order ──asks──► Customer ──asks──► Address
         ReturnLabelPrinter  ──domestic?──► Order ──asks──► Customer ──asks──► Address
                                                                        Address ──asks──► Region
```

Nothing here is about making fewer calls — the after version still crosses the same objects to
get the answer. What changes is that every call stays local: `Order` only ever calls `Customer`,
`Customer` only ever calls `Address`, and `Address` asks its own `Region` if it has one. When the
region migration ships, only `Address` (and the `Region` it now holds) has to learn the new
shape. `Customer`, `Order`, `CancellationPolicy` and `ReturnLabelPrinter` are unchanged and still
correct, because none of them ever reached past their immediate neighbor in the first place.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Distant caller | `CancellationPolicy`, `ReturnLabelPrinter` | Two or more independent callers that each walk the same chain of getters to reach one fact several objects away |
| First collaborator | `Order` | The object the caller is actually allowed to know about |
| Relay | `Customer` | An object that receives a question and forwards it to whichever of its own fields owns the answer |
| Data owner | `Address`, `Region`, `Country` | The object the original chain was really asking about — now the one that answers for itself, even when the business inserts a new hop (`Region`) between it and the caller |

## Walk the stages

1. **before** — `CancellationPolicy.canAutoRefund` and `ReturnLabelPrinter.needsCustomsForm` each
   walk `order.customer.address.country.code` on their own. A test with an ordinary address
   (country set directly) passes for both. A second test gives both callers a *migrated*
   address — one where the country has moved behind a `Region` — and both silently return the
   wrong, conservative answer: no auto-refund, and a customs form required, for a customer who
   is actually domestic. Neither caller crashed. Neither caller was told about `Region` either,
   because each one owns its own private copy of the chain.
2. **after** — `Order.canAutoRefund()` and `Order.needsCustomsForm()` ask `Customer` one
   question each; `Customer` asks `Address`; `Address` asks its own `Region` when it has one,
   or reads its own `Country` when it doesn't. `CancellationPolicy` and `ReturnLabelPrinter` are
   unchanged from the before stage's *call sites* — same method signatures, same call — and now
   give the correct answer for the ordinary address, the migrated address, and even a pickup
   point address that has neither a country nor a region.

## Trade-offs / when not to

Not every chain is a violation. A **fluent builder** — `order.items().add(x).add(y)` — returns
`this` or a sibling in the same conceptual object on purpose; the caller isn't reaching into a
different object's internals, it's composing one. Navigating a **plain data structure** — a
parsed JSON document, a DTO, a tree the caller is meant to traverse — isn't a violation either;
the point of a DTO is to be read, and it has no behaviour to delegate to. The Law of Demeter is
about objects with responsibilities, not about banning dots.

Pushing every hop's data through a wrapper method can go too far the other way. If `Order` grows
a forwarding method for every field `Customer`, `Address`, `Region` and `Country` might ever need
to expose, `Order` becomes a **god-object facade** — all the original coupling still exists, just
hidden behind one class instead of spread across four. The fix in this concept works because
each method landed on the object that already owned the decision (`Address` decides what
"domestic" means, `Region` decides it for itself when it's the one holding the country), not
because the chain got shorter.

## Common misconceptions

- **"Fewer dots is the goal."** The after version still crosses the same objects to answer the
  same question. What changed is that each hop is local — every call is on an object the caller
  directly holds — not that there are fewer calls.
- **"This is the same thing as tell, don't ask."** They travel together but answer different
  questions. Law of Demeter is about *who a method is allowed to call* (see `tell-dont-ask`);
  tell-don't-ask is about *whether a caller decides for an object or asks the object to decide
  for itself*. A method can obey one and violate the other.
- **"Any method chain is a train wreck."** A chain that stays inside one object's own API
  (a builder, a query composed step by step) isn't reaching into anyone else's internals — the
  smell is specifically the object handed back by one call having *its own, unrelated* internals
  dug into by the next call.
- **"The bug is the null check."** The defensive fallback in the before stage isn't wrong on its
  own — it's what stops the code from crashing. The actual cost is that two callers each had to
  write, and now each have to update, their own copy of the same fallback, and neither one is
  the object that actually knows what "domestic" means.

## References

- [Law of Demeter](https://en.wikipedia.org/wiki/Law_of_Demeter) — Wikipedia
- [General formulation of the Law of Demeter](https://www2.ccs.neu.edu/research/demeter/demeter-method/LawOfDemeter/general-formulation.html) — Northeastern University, Demeter Project
