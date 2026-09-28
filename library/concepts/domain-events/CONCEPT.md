# Domain events

> Something happened inside the aggregate. Record the fact; let whoever cares react to it.

## The problem

A business method like "cancel this order" often has to trigger several unrelated reactions: release the
reserved inventory, tell the customer by email, adjust a loyalty ledger. The easy way to write it is inline —
`cancel()` calls all three, one after another. That makes the aggregate depend on three collaborators that
have nothing to do with the invariant it actually owns (can an already-cancelled order be cancelled again?).
It also makes the method's success all-or-nothing in the wrong way: if the third call fails, the first two
already ran, and now inventory is released for an order that's still marked "pending" in the database. Testing
`cancel()` at all means constructing working — or carefully broken — fakes for all three collaborators, even
if the test only cares whether the status changed. And the day someone needs a fourth reaction (a fraud check,
an audit log entry), the fix is to edit the aggregate method again.

## The idea

Split "what happened" from "what should happen next." The aggregate's method changes its own state and
records an **event** — an immutable, past-tense fact (`OrderCancelled`, not `CancelOrder`) — instead of calling
any collaborator directly. The application service that orchestrates the use case saves the aggregate, and
only *after* that succeeds, hands the recorded events to a **dispatcher**: a small in-process registry that
knows which **handlers** are interested in which event type. Each handler is an independent piece of code —
release inventory, send an email, update the ledger — with no idea the others exist, and no idea `Order`
exists either, beyond the event's shape. Adding a fourth reaction means registering a fourth handler; `Order`
and `OrderCancelled` never change.

```text
before:  Order.cancel() ──► InventoryService.release()
                        ──► Mailer.send()          (any failure here aborts the rest)
                        ──► LoyaltyLedger.record()

after:   Order.cancel() ──► records OrderCancelled            (state change only)
         save(order)    ──► dispatcher.dispatch(events) ──► ReleaseInventoryHandler
                                                        ──► SendCancellationEmailHandler
                                                        ──► RecordLoyaltyCancellationHandler
```

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Domain event | `OrderCancelled { orderId, reason, occurredAt }` | A past-tense, immutable record with no methods that change anything |
| Event-recording method | `Order.cancel()` | A domain method that appends to an internal list instead of calling services |
| Dispatcher | `EventDispatcher` | A registry mapping an event type to a list of handlers, invoked after a save |
| Handler | `ReleaseInventoryHandler` | A small class or function that reacts to one event type and knows nothing about the aggregate |
| Application service | `CancelOrderService` | The orchestration layer: load, call the domain method, save, then dispatch |

## Walk the stages

1. **before** — `Order.cancel()` takes an `InventoryService`, a `Mailer` and a `LoyaltyLedger` as
   collaborators and calls all three in sequence before flipping its status. A failing mailer means inventory
   was released but the order is still "pending" — the two disagree, and nothing rolls the first call back.
   Every test of `cancel()`, even one that only checks the status, has to construct all three collaborators.
2. **after** — `Order.cancel()` takes no collaborators. It changes `status` and appends an `OrderCancelled` to
   its own list of pending events, using a clock it's handed (never the wall clock — see the reasoning in
   `unit-of-work`, since this is the same kind of dependency the aggregate should never reach out for on its
   own). The application service loads the order, calls `cancel()`, **saves it**, and only then pulls the
   recorded events and dispatches them. If the save fails, dispatch never happens — the event only goes out for
   a change that's actually durable. If a handler fails partway through dispatch, the ones before it already
   ran and the order stays saved as cancelled either way: the aggregate's state was never contingent on the
   handlers succeeding.

## Trade-offs / when not to

A dispatched-after-save event is *eventually* consistent with its handlers, not atomically consistent: between
the commit and the last handler running, the system is in a state where the order is cancelled but (say) the
email hasn't gone out yet. For an in-process, single-machine dispatcher that's usually a few instructions'
delay and nobody notices. It stops being fine the moment the process can crash between the save and the
dispatch, or a handler needs to survive a restart and retry — at that point the events themselves need to be
written durably alongside the aggregate and delivered by a separate process, which is what the **outbox**
pattern (not yet in this library) is for. Don't reach for events at all when there's exactly one reaction and
it's part of the same invariant the aggregate already owns — that's just a private method, not a domain event.

## Common misconceptions

- "A domain event and an integration event are the same thing." An **in-process** domain event like
  `OrderCancelled` here is just a message between collaborators inside one deployable; it never needs
  serialization. The moment a different service must react to it, it has become an **integration event**,
  crossing a process boundary — a much bigger commitment (versioning, delivery guarantees) than appending to a
  list and calling handlers in the same call stack.
- "The event is a command in disguise." `OrderCancelled` doesn't ask for anything; it states something that
  already happened, and cannot fail or be rejected. `CancelOrder` (a command) can be refused; an event about
  something that already occurred cannot — if a handler doesn't like it, that's the handler's problem, not the
  event's.
- "Dispatching before saving is more efficient." It looks the same in a demo and is wrong the moment a handler
  observes an event for a change that a subsequent failure then rolls back — the save must succeed first.
- "One dispatcher call means one delivery guarantee." A plain in-memory list gives *at-most-once*, best-effort
  delivery within the same process run; it says nothing about what happens if the process dies mid-dispatch.

## References

- Fowler, [DomainEvent](https://martinfowler.com/eaaDev/DomainEvent.html)
- Microsoft, [Domain events: design and implementation](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation)
