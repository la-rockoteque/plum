# Test through the public API

> The unit under test is a behaviour, not a class - test what it promises callers, not how it keeps that promise.

## The problem

A test can reach anywhere its language lets it: a private method, a private field, an object the class under test
built for itself and never exposed. Reaching in feels efficient - no fake to write, no port to thread through a
constructor, just call the helper and check the number. But a private helper, a private field, and a
self-constructed collaborator are all implementation, not contract. Nothing promises they'll still exist tomorrow.
A developer who inlines a helper, renames a field, or swaps one internal collaborator for another has changed
nothing a caller can observe - and yet the test suite turns red. The team now either reverts a good refactor to
keep the build green, or rewrites tests that were never about behaviour in the first place. Either way, the test
suite just taught everyone that refactoring is dangerous, which is exactly backwards.

## The idea

Test the operation callers actually invoke, and check only what callers can actually observe: a return value, a
row a later read finds, a message a collaborator received. Never reach past the public operation to call a
private helper, assert on a private field, or swap out a collaborator the unit built for itself - if it isn't
constructor-injected, it isn't a seam, and poking it anyway couples the test to today's internal shape.

```text
before: the test calls _calculateFee() directly, reads _feeRate directly, replaces the private
        _formatter the service built for itself - three seams that were never promised to exist.

after:  the test calls cancel() and checks the return value, the repository's stored row, and the
        notifier's recorded message - three things the public contract actually promises.

A pure refactor (inline the helper, rename the field) changes none of the "after" seams.
It breaks every one of the "before" seams.
```

The two implementations in this concept - a pre-refactor version and a behaviour-preserving post-refactor
version - produce identical output for every caller. Only their private shape differs: the refactor inlines a fee
calculation helper into `cancel()` and renames the field it read. A test suite that only calls `cancel()` and
checks the outcome doesn't notice the refactor happened. A test suite that called the helper directly, or read the
old field name, breaks - not because behaviour changed, but because the test was never testing behaviour.

## Roles - find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Unit under test | `PreRefactorService` / `PostRefactorService` | The class whose public operation is the actual requirement |
| Public operation | `cancel()` | The one method a caller (or another module) is allowed to call |
| Private helper | `calculateFee()` | A method that exists to organise the implementation, not to be called from outside |
| Private field | `feeRate` → renamed to `cancellationFeeRate` | State with no accessor, readable only by reaching past encapsulation |
| Self-built collaborator | `NotificationFormatter` | An object the unit constructs itself; not passed in, so not a seam a test may legitimately swap |
| Observable boundary (fake) | `OrderRepository` | A port the unit depends on; a fake here gives the test a legitimate way to observe stored state |
| Observable boundary (spy) | `Notifier` | A port whose calls the test may legitimately record and assert on afterwards |

## Walk the stages

1. **before** - both implementations exist side by side. A test calls `calculateFee()` directly and reads
   `feeRate` directly against the pre-refactor version - and passes, because that version still has both. A second
   test replaces the service's own `NotificationFormatter` with a hand-rolled double reached in after construction
   - also passes, but only by coupling itself to the fact that the service happens to build one particular kind of
   collaborator internally. A third test runs the exact same kind of check against the post-refactor version and
   proves it no longer holds: the helper is gone (inlined into `cancel()`), the old field name is gone (renamed).
   Every test in this stage passes - the point isn't a red test, it's a passing test whose assertion is "this
   assumption about internals no longer holds."
2. **after** - the same two implementations, but every test drives `cancel()` and checks only what a caller can
   observe: the returned outcome, the row the fake repository now holds, the message the spy notifier recorded.
   The exact same test function runs against `PreRefactorService` and against `PostRefactorService` with no
   changes and no special-casing, because the refactor never touched any of the three things being observed.

## Trade-offs / when not to

Testing only through the public API costs a little more setup - a fake repository and a spy notifier instead of
one direct field read - and it can't pin down an algorithm's internal correctness the way a focused unit test on
the helper itself can. For a genuinely tricky, isolable algorithm (a pricing formula with edge cases, a parser's
state machine), a white-box test of that piece in isolation is a reasonable, deliberate choice - the trade-off is
accepted knowingly, not backed into because reaching in was easier at the time. The distinction is whether the
thing being tested has its own contract worth pinning down on its own, or whether it's just an implementation
detail of a larger operation that already has a contract: `cancel()`.

## Common misconceptions

- **"More assertions is more thorough."** An assertion on a private field is not extra coverage over asserting the
  observable outcome - it's coverage of something nobody promised to keep stable, at the cost of coupling the test
  to it.
- **"If it has a name, it's testable."** A private helper having a name and a return value doesn't make it a
  contract. Naming something doesn't promise it will still exist after the next refactor.
- **"Mocking my own class's collaborator is the same as mocking a dependency."** A port passed into the
  constructor is a seam the unit's contract accepts. An object the unit builds for itself is not - swapping it
  requires reaching past the constructor, which is the same "don't mock what you don't own" violation whether the
  collaborator lives in another package or the same file.
- **"A broken test after a refactor means the refactor was wrong."** Sometimes it means the test was testing the
  wrong thing. A refactor that a caller cannot observe should not be able to break a test that only observes what
  a caller can observe.

## References

- Martin Fowler, [TestDouble](https://martinfowler.com/bliki/TestDouble.html).
- Testing on the Toilet, [Prefer Testing the Public API over Implementation-Detail Classes](https://testing.googleblog.com/2015/01/testing-on-toilet-prefer-testing-public.html).
- Kent Beck, *Test-Driven Development: By Example* (Addison-Wesley, 2002).
