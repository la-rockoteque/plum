# Law of Demeter

> Only talk to your immediate friends: yourself, your parameters, objects you create, and the
> objects you directly hold — never to what one of those hands back to you.

## The problem

A cancellation workflow needs two decisions: does the return ship with a local courier, and
can the refund happen automatically? Both answers live somewhere inside the customer, so the
code reaches in and gets them: `order.customer().address().country().code()` to check the
country, `order.customer().wallet().card().isExpired()` to check the card. It reads fine, and
it works — right up until the shape at the far end of the chain changes.

Add a second kind of address for orders returned to a pickup point instead of a home — one that
was never tied to a single country's customs — and the first chain has nothing to read: the
call that used to reach `.country().code()` now reaches through nothing at all. Move the card
from the wallet to a separate payment profile, and the second chain breaks the same way. Neither
change touched the *business rule* about shipping or refunds. Both changes still broke the
caller, because the caller had wired itself directly to the internal path between it and the
fact it wanted, not to the fact itself.

This is the **train wreck**: a chain of calls, each one handing back an object the caller then
digs into again, `a.b().c().d()`. The caller ends up knowing the internal structure of objects
it has no direct relationship with — coupling to a shape, not to a responsibility.

## The idea

The Law of Demeter (originally "only talk to your immediate friends") says a method should call
methods only on: itself, its parameters, objects it creates, and objects it directly holds. It
should not call a method on an object that a *different* call just handed back.

```text
before:  CancellationPolicy ──customer──► Order
                             ──.address().country().code()──► (reaches three hops past Order)
                             ──.wallet().card().isExpired()──► (reaches three hops past Order)

after:   CancellationPolicy ──ships domestically?──► Order ──asks──► Customer ──asks──► Address
                             ──can auto-refund?────► Order ──asks──► Customer ──asks──► Wallet
```

Nothing here is about making fewer calls — the after version still crosses four objects to get
the same answer. What changes is that every call stays local: `Order` only ever calls
`Customer`, `Customer` only ever calls `Address` or `Wallet`, and each object answers using only
its own field. When the pickup-point address arrives, only `Address.isDomestic()` has to know
what a missing country means. Every caller further out — `Customer`, `Order`,
`CancellationPolicy` — is unaffected, because none of them ever reached past their immediate
neighbor in the first place.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Distant caller | `CancellationPolicy` | Code that calls a chain of getters to reach one fact several objects away |
| First collaborator | `Order` | The object the caller is actually allowed to know about |
| Relay | `Customer` | An object that receives a question and forwards it to whichever of its own fields owns the answer |
| Data owner | `Address`, `Wallet`, `Card` | The object the original chain was really asking about — now the one that answers for itself |

## Walk the stages

1. **before** — `CancellationPolicy.shipsDomestically` and `.canAutoRefund` each walk a chain
   four objects deep: `order.customer.address.country.code` and
   `order.customer.wallet.card.expired`. A test with a normal, fully-populated order passes.
   A second test gives the same code a pickup-point address — one whose `country` is absent
   because it was never tied to a single country's customs — and the shipping check breaks: the
   chain reaches for a link that isn't there.
2. **after** — `Order.returnsShipDomestically()` and `Order.canAutoRefund()` ask `Customer` one
   question each; `Customer` asks `Address` and `Wallet` one question each; `Address` and
   `Wallet` answer using only their own field. The same pickup-point address now makes
   `Address.isDomestic()` return `false` — a normal, correct answer — instead of the caller
   reaching through a hole three hops downstream.

## Trade-offs / when not to

Not every chain is a violation. A **fluent builder** — `order.items().add(x).add(y)` — returns
`this` or a sibling in the same conceptual object on purpose; the caller isn't reaching into a
different object's internals, it's composing one. Navigating a **plain data structure** — a
parsed JSON document, a DTO, a tree the caller is meant to traverse — isn't a violation either;
the point of a DTO is to be read, and it has no behaviour to delegate to. The Law of Demeter is
about objects with responsibilities, not about banning dots.

Pushing every hop's data through a wrapper method can go too far the other way. If `Order` grows
a forwarding method for every field `Customer`, `Address`, `Wallet` and `Card` might ever need to
expose, `Order` becomes a **god-object facade** — all the original coupling still exists, just
hidden behind one class instead of spread across four. The fix in this concept works because
each method landed on the object that already owned the decision (`Address` decides what
"domestic" means), not because the chain got shorter.

## Common misconceptions

- **"Fewer dots is the goal."** The after version still crosses the same four objects to answer
  the same two questions. What changed is that each hop is local — every call is on an object
  the caller directly holds — not that there are fewer calls.
- **"This is the same thing as `tell, don't ask`."** They travel together but answer different
  questions. Law of Demeter is about *who you're allowed to call*; asking an object to act
  instead of reading its state and deciding externally is a related but separate discipline.
- **"Any method chain is a train wreck."** A chain that stays inside one object's own API
  (a builder, a query composed step by step) isn't reaching into anyone else's internals — the
  smell is specifically the object handed back by one call having *its own, unrelated* internals
  dug into by the next call.

## References

- [Law of Demeter](https://en.wikipedia.org/wiki/Law_of_Demeter) — Wikipedia
- [General formulation of the Law of Demeter](https://www2.ccs.neu.edu/research/demeter/demeter-method/LawOfDemeter/general-formulation.html) — Northeastern University, Demeter Project
