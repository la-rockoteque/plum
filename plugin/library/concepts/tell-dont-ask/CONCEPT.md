# Tell, Don't Ask

> Don't ask an object for its state, decide on its behalf, and write the state back. Tell it what
> you want, and let it decide.

## The problem

An order can be cancelled from three different places: a customer-facing API handler, a nightly
job that auto-cancels stale orders, and an admin tool support uses to force a cancellation. The
`Order` itself is just data — a status, a shipped-at timestamp, a cancelled-at timestamp, a
refund amount — all public and all mutable. So each of the three callers does the same dance: it
reads `order.status`, decides in its own `if` whether cancelling is allowed, and then writes
`status`, `cancelledAt` and `refundDue` back onto the order itself.

Three callers, three copies of the same decision, and no guarantee they agree. The API handler
gets it right. The nightly job, added later by someone in a hurry, remembers to flip the status
and set the timestamp but forgets the refund line — the customer paid, the order is cancelled,
and no refund is ever recorded. The admin tool, built to force through edge cases, never re-checks
the status at all, so it happily cancels an order that has already shipped. Every caller compiles,
every test that only exercises one caller passes, and the business rule — *a shipped order cannot
be cancelled, and a cancelled order always gets its refund recorded* — exists nowhere as one piece
of code. It exists as an intention, repeated with variations, in every place that touched
`Order`.

## The idea

Tell-don't-ask reverses the direction of the conversation. Instead of a caller asking an object
for its internals, branching on the answer, and pushing new internals back in, the caller tells
the object what it wants done, and the object decides for itself whether and how to do it.

```text
before:  caller ──reads status──► Order
         caller ──decides in its own if──► (three different decisions, three different callers)
         caller ──writes status, cancelledAt, refundDue──► Order

after:   caller ──tells "cancel"──► Order.cancel(clock)
                                    Order checks its own status,
                                    Order records its own cancelledAt,
                                    Order computes its own refund,
                                    Order rejects the call if the transition is invalid
```

`Order.cancel(clock)` becomes the only path to cancellation. It is where the status check lives,
where the cancelled timestamp gets recorded, and where the refund gets computed — once. A caller
that used to need six lines of reading, branching and writing now needs one: `order.cancel(clock)`.
The setters that let a caller write `status` or `refundDue` directly are gone, so there is no way
to build a fourth caller that repeats the old mistake; the only way to change an order's state is
to ask it to change it, and it enforces its own rule every time.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Anemic object | `Order` (before) | A class that is mostly public fields, with the surrounding code doing all the deciding |
| Getter-then-branch caller | `ApiCancelHandler`, `NightlyCancelJob`, `AdminCancelTool` | Code that reads a field, has an `if` on it, then writes a different field back |
| Command method | `Order.cancel(clock)` | A verb-shaped method that both makes the decision and changes the state, replacing the read-decide-write sequence |
| Rich object | `Order` (after) | The same class, now the single place the rule is written down and enforced |

## Walk the stages

1. **before** — `Order` has a mutable `status`, `cancelledAt`, and `refundDue`. `ApiCancelHandler`
   checks `status == Pending`, then sets all three fields; a test with a normal pending order
   passes. `NightlyCancelJob` does almost the same thing but never sets the refund — a passing
   test shows the order ends up cancelled with a refund of zero, even though the customer paid.
   `AdminCancelTool` skips the status check entirely — a passing test shows an already-shipped
   order silently becoming cancelled, a transition that should never be allowed.
2. **after** — `Order.cancel(clock)` owns the whole rule: it rejects the call if the order isn't
   pending, and otherwise sets the cancelled timestamp and the refund together, in one place. All
   three callers are reduced to `order.cancel(clock)`. The same three scenarios now agree: a
   pending order cancels correctly no matter which caller asked, and a shipped order is rejected
   no matter which caller asked — the invalid transition is caught once, not per caller. This is a
   deliberate behaviour change for `NightlyCancelJob`: before, it silently skipped a shipped order
   (the same `if status != pending: return` as every other case it didn't handle); after, calling
   it on a shipped order raises, the same as every other caller — a caller that used to fail quietly
   now fails loudly, which is the point of centralising the rule.

## Trade-offs / when not to

Tell-don't-ask is about **commands**, not queries. Command-query separation (CQS) still allows —
even expects — an object to answer plain questions about itself (`order.isPending()`,
`order.refundDueCents`); the smell is a caller using that answer to make a decision the object
should be making itself, then writing the result back in. A read model built purely to be
displayed or reported on (a DTO, a response body, a projection for a dashboard) is allowed to be
plain data with no behaviour at all — it isn't standing in for a decision, so there's no rule to
protect. Pushing every conceivable action into methods on the aggregate can also go too far: a
handful of fields genuinely owned by the caller's own workflow (a UI's selected filter, a batch
job's cursor) don't need Order-style encapsulation just because Order does.

## Common misconceptions

- **"Tell-don't-ask means no getters."** `Order.status` is fine to expose as a read-only query;
  what tell-don't-ask objects to is a caller using that query to decide the object's *next state*
  and then writing it back externally, rather than asking the object to make and apply that
  decision itself.
- **"This is the same discipline as the Law of Demeter."** They travel together but aren't the
  same rule. Law of Demeter is about *who a method is allowed to call* (see `law-of-demeter`);
  tell-don't-ask is about *whether a caller decides for an object or asks the object to decide for
  itself*. A method can obey one and violate the other.
- **"An anemic model is just a style choice."** In `CQRS`-style architectures a command side can
  legitimately look rich (this concept) while a query side is legitimately anemic data shaped for
  reading — see `cqrs`. The problem in the before version isn't that `Order` has fields; it's that
  a business rule about *when those fields may change* was left to be reimplemented by every
  caller instead of owned by the object the rule is about.
- **"This is the same fix as `dry`."** Both move duplicated knowledge onto `Order`, but they move
  different halves of it: `dry` moves a *query* — a read-only rule like "can this be cancelled?" —
  onto the object so every caller asks the same question; tell-don't-ask moves the *command* — the
  decision and the state change themselves — so every caller stops deciding and writing the answer
  back on the object's behalf.

## References

- [Tell, Don't Ask](https://martinfowler.com/bliki/TellDontAsk.html) — Martin Fowler
- [AnemicDomainModel](https://martinfowler.com/bliki/AnemicDomainModel.html) — Martin Fowler
