# Interface Segregation Principle

> No client should be forced to depend on methods it doesn't use.

## The problem

One persistence interface grows over time: get, save, delete, list, export, audit, purge. Every new
storage-adjacent need gets bolted on, because it's already the place callers go for storage. But most
clients only need a sliver of it. A use case that cancels an order calls `get` and `save` — nothing else —
yet it depends on, and must satisfy, all seven methods.

The cost shows up first in tests. A test double for that use case has to implement the whole interface, so
five methods exist purely to make the compiler (or the duck-typing) happy: dead stubs that raise "not used"
because nothing legitimately calls them. Then the interface grows an eighth method for a feature that has
nothing to do with cancelling anything — and the cancel-order test's fake has to grow too, even though
cancelling an order didn't change at all. The fat interface has coupled two unrelated things: how you
cancel an order, and how you export one to CSV.

## The idea

Split the fat interface along what each client actually calls. Each role gets its own small interface,
declared next to the client that needs it:

```text
before:                                  after:
CancelOrder ──► OrderStore (7 methods)   CancelOrder   ──► CancelOrderStore (get, save)
                 get, save,                                          ▲
                 delete, listByCustomer,                             │
                 exportCsv, auditTrail,   SomeOtherClient ──► OrderArchiver (archive)
                 purgeOlderThan                                      ▲
                                                                      │
                                          OrderStoreAdapter ──────────┴─── implements both
```

The concrete adapter can still implement several role interfaces at once — it's one class backed by one
store. What changes is the *contract each client depends on*. `CancelOrder` never sees `archive`, `export`,
or `purge`; when one of those grows a new method, nothing that depends on `CancelOrderStore` even
recompiles, let alone needs a new test double.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Fat interface | `OrderStore` (get, save, delete, list, export, audit, purge) | An interface whose method count keeps climbing as unrelated features land |
| Client / use case | `CancelOrder` | Code that depends on the fat interface but calls only a couple of its methods |
| Forced-fat test double | `FakeOrderStoreV1` | A fake or mock stubbing methods it never calls, usually throwing or `NotImplementedError` |
| Role interface | `CancelOrderStore` (get, save) | A small interface declared next to (or owned by) the one client that needs it |
| Concrete adapter | `OrderStoreAdapter` | One implementation class satisfying several role interfaces at once — that's fine; only the *contract per client* needs to be narrow |

## Walk the stages

1. **before** — `CancelOrder` depends on `OrderStoreV1`, a seven-method interface. Its test fake must
   implement all seven; five are stubs that exist only to satisfy the type, and raise if ever called. Then
   the interface grows an eighth method, `archive`, for a feature that has nothing to do with cancelling —
   and the fake has to grow with it. Compare the two fakes side by side: `CancelOrder`'s own logic is
   identical in both, but the fake needed for it picked up one more unused stub purely because the
   interface it happens to depend on grew. That's the change cost: a class N methods wide forces every
   client, and every test double for every client, to track all N methods forever.
2. **after** — `CancelOrder` now depends on `CancelOrderStore`, declared next to it, with exactly the two
   methods it calls. Its fake has exactly two methods, both real — no stub, nothing to raise. A separate
   role interface, `OrderArchiver`, exists for whichever client needs archiving. The same concrete adapter
   implements both roles, but growing `OrderArchiver` (or adding a third role interface for CSV export)
   never touches `CancelOrder` or its fake, because they were never coupled to it in the first place.

## Trade-offs / when not to

Segregating interfaces costs an extra declaration per role and, in statically typed languages, an adapter
that implements more than one of them. That cost is worth paying when a fat interface's clients already
diverge — different callers, different change reasons, different test doubles growing unused stubs. It is
not worth paying to give every single method its own one-method interface "just in case": that trades one
kind of coupling (a fat contract) for another kind of clutter (dozens of near-identical interfaces to
navigate), and produces the same kind of abstraction Yagni warns against — built for a second implementation
that never shows up. Segregate along real fault lines between clients, not along every method boundary.

## Common misconceptions

- **"ISP means one method per interface."** That's the over-correction. The principle is about matching
  interface shape to *client* needs, not minimizing method count for its own sake — a role interface with
  three cohesive methods used together by one client is still segregated correctly.
- **"The concrete class can only implement one interface."** It can implement as many role interfaces as
  it genuinely fulfils; `OrderStoreAdapter` implements both `CancelOrderStore` and `OrderArchiver`. What's
  narrow is each *client's* view, not the adapter.
- **"A fake with unused stubs is a test-writing problem."** It's a design signal (see `test-doubles`): a
  fake stuffed with `NotImplementedError` methods is telling you the interface it fakes is wider than the
  client it's faking for.
- **"This is the same as dependency inversion."** Related but distinct: dependency inversion says depend on
  an abstraction, not a concretion; interface segregation says *which* abstraction — the narrow one shaped
  by the client, not the union of every client's needs.

## References

- Robert C. Martin et al., [SOLID](https://en.wikipedia.org/wiki/SOLID).
- The Go Blog, [Effective Go — Interfaces](https://go.dev/doc/effective_go#interfaces): "The bigger the
  interface, the weaker the abstraction."
