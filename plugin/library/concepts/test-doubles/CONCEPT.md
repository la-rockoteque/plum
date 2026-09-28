# Test Doubles: dummy, stub, spy, mock, fake

> Not every stand-in is the same kind of stand-in. Naming which one you're using tells the next reader what the test actually checks.

## The problem

A use case talks to collaborators it doesn't own: a payment gateway, a mailer, a repository. Test it against the
real things and the test now needs a network, a mail server, a database — slow, flaky, and unrunnable offline.
The instinct to "just mock it" is right, but stopping there hides a second problem: reaching for one tool
(usually "a mock") for every collaborator, regardless of what the test needs to prove, produces tests that are
brittle for reasons nobody can name. A test that fails because a mock recorded a call in the wrong order, on a
collaborator whose call order was never part of the requirement, is failing for the test's own convenience —
not because the code is wrong.

## The idea

Gerard Meszaros' taxonomy splits "a fake collaborator" into five roles, chosen by what the test needs from that
particular collaborator:

- **Dummy** — passed because the signature requires it; never invoked. Its only job is to compile.
- **Stub** — returns a canned answer so the code under test can keep going. Nobody asserts on the stub itself.
- **Spy** — records what happened, so the test can inspect it afterwards. This is **state verification**: assert
  on what the spy captured, once the call is over.
- **Mock** — pre-programmed with an expectation; it fails the moment it's called wrong. This is **behaviour
  verification**: the assertion lives inside the double, checked as the call happens.
- **Fake** — a working, lighter-weight implementation (an in-memory store instead of a database). It has real
  behaviour — round-trip a value through it and it comes back — just not the production one.

```text
CancelOrder
  ├─ OrderRepository  ──► fake   (in-memory, real get/save round-trip)
  ├─ PaymentGateway   ──► stub   (canned "declined", drives the audit-log branch)
  │                   ──► mock   (fails on the wrong order id or amount)
  ├─ Mailer           ──► spy    (records the message; assert after)
  └─ AuditLogger      ──► dummy  (happy path: never called)
                       ──► spy   (decline path: records the message)
```

The same port (`PaymentGateway`) can be filled by a stub in one test and a mock in another — the choice isn't a
property of the port, it's a property of what that test needs to prove. `AuditLogger` makes the same point from
the other side: it's a dummy in every test where the charge is approved, and only earns a real (spy) double in
the one test that drives it.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Use case under test | `CancelOrder` | The unit whose business outcome the test cares about |
| Port | `PaymentGateway`, `Mailer`, `OrderRepository` | An interface the use case depends on, not a concrete client |
| Dummy | `NullAuditLogger` | A parameter or field a *particular* test never asserts on and the code never calls on that path |
| Stub | `StubPaymentGateway` | A canned return value; no recorded calls, no expectations — but the canned value can still drive a branch |
| Spy | `SpyMailer`, `SpyAuditLogger` | A list or counter the test reads *after* the call, to assert state |
| Mock | `MockPaymentGateway` | A double holding an expected call that raises/fails on mismatch |
| Fake | `InMemoryOrderRepository` | A real, working implementation over an in-memory structure that copies on read and write |

## Walk the stages

1. **before** — `CancelOrder` constructs its own `SmtpMailer` and `HttpPaymentGateway`. Both are real-dependency
   stand-ins, per this library's convention, that raise "network unavailable" rather than actually reach a
   network. The only test possible here asserts that the call blows up; nothing about whether the order was
   correctly cancelled, charged, or the right email was sent is observable. That's the cost of a use case that
   owns its own infrastructure: the test can prove the code *runs into* its dependency, not what it does with it.
2. **after** — every collaborator is injected as a port (see dependency-inversion: a double is only pluggable
   because there's an abstraction to plug it into). The tests now show each of the five roles, one at a time:
   a dummy audit logger nobody calls because the charge is approved, a stub gateway whose canned "declined"
   answer drives a branch where the order is *not* cancelled and the audit logger — now a spy — records why, a
   mock gateway that checks it was charged the *right* order and amount and fails otherwise, a spy mailer whose
   sent messages are asserted after the fact, and a fake repository whose `save` then `get` round-trip proves
   real (if in-memory) persistence behaviour: it copies on both ends, so mutating what `get` returned can't leak
   into storage without going through `save`.

## Trade-offs / when not to

Dummies and stubs are nearly free — reach for them by default whenever a collaborator's behaviour isn't what the
test is about. Spies and mocks cost more to write and read; use them for the one or two collaborators whose
*interaction* is the actual requirement (did we charge the right amount?). Fakes cost the most to build and
maintain — a fake earns that cost when several tests need the same realistic round-trip behaviour, or when a
mock's expectations would otherwise be copy-pasted across many tests. For a single test that needs one call
recorded once, a fake is over-engineering; for a repository exercised by dozens of tests, a hand-rolled mock per
test is the more expensive choice.

## Common misconceptions

- **"Mock" means any test double.** Colloquially, yes — but conflating them hides which kind of assertion a test
  is making. A "mock" that nobody asserts on is a stub wearing the wrong name.
- **"More mocking is safer."** Mocking every collaborator — including the ones whose behaviour isn't in question
  — couples the test to *how* the code calls its dependencies instead of *what* it accomplishes. A refactor that
  changes call order but not behaviour now breaks tests that had no business caring about call order.
  Over-mocking is a signal to ask what this test is actually verifying.
- **"A double needs no seam."** A test can only plug in a double where the use case depends on an abstraction,
  not a concrete class it constructs itself — the `before` stage has no ports, so it has no doubles, only a
  crash.
- **"A fake is just a bigger stub."** A fake has real behaviour: state written to it can be read back correctly.
  A stub's canned answer doesn't change based on what was written to it.

## References

- Martin Fowler, [TestDouble](https://martinfowler.com/bliki/TestDouble.html).
- Martin Fowler, [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html).
- Gerard Meszaros, *xUnit Test Patterns: Refactoring Test Code* (Addison-Wesley, 2007).
