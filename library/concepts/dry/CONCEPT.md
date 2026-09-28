# DRY — Don't Repeat Yourself

> Every piece of knowledge should have a single, unambiguous, authoritative representation.

## The problem

A business rule — "can this order still be cancelled?" — starts small enough to write inline wherever it's
needed: a CLI command, an API endpoint. Each copy looks harmless on its own. Then the rule changes: a window
gets added, a status gets excluded, an edge case gets patched. The fix lands wherever the bug was reported —
one call site — and the other copies quietly keep the old behavior. Nothing crashes. Nothing looks wrong until
two entry points disagree about the same order on the same day, and no single diff explains why.

## The idea

Duplication isn't really about repeated *text*; it's about repeated *knowledge*. When one rule is written down
in two places, "add a case" becomes two edits instead of one, and forgetting either one is a silent, compiling,
passing-until-you-notice bug. The fix is not to compress code for its own sake — it's to give each piece of
business knowledge exactly one place to live, and to make everyone who needs it ask that one place.

```text
before:  CliHandler --(copy A of the rule)-->  bool
         ApiHandler  --(copy B of the rule)-->  bool      # A and B can drift

after:   Order.canBeCancelled() --(the rule)--> bool
         CliHandler --(asks)--> Order
         ApiHandler  --(asks)--> Order            # one answer, everywhere
```

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| The duplicated knowledge | "pending, not shipped, inside the window" | A conditional or calculation copy-pasted across handlers |
| The entry points | `CliCancelHandler`, `ApiCancelHandler` | Controllers, CLI commands, background jobs that each re-derive the same fact |
| The rightful owner | `Order.canBeCancelled()` | The domain object the rule is actually about |
| The seam that made it testable | `Clock` | An injected time/random/config source so the rule can be tested without waiting or mocking globals |

## Walk the stages

1. **before** — read `CliCancelHandler.canCancel` and `ApiCancelHandler.canCancel` side by side. They started
   identical. Notice which one was patched with a cancellation-window check and which one wasn't — that's the
   copy-paste tax: the same fix, paid for twice, and only collected once. The test named "disagree" pins this
   down: same order, same clock, two different answers.
2. **after** — the rule moves onto `Order` as `canBeCancelled(clock)`. Both handlers now call it instead of
   restating it. The previously-disagreeing case is now one code path, so it cannot drift — the equivalent test
   is renamed "agree".

## Trade-offs / when not to

Chasing DRY too early creates the opposite problem: a shared helper with parameters for every caller's slight
variation, more confusing than the duplication it replaced. Two blocks of code that happen to look alike right
now are not automatically one rule — see the misconception below. Extracting a shared abstraction has a cost
(an indirection everyone must now understand); pay it when the *knowledge*, not just the text, is one thing.

## Common misconceptions

- **"Identical-looking code is always duplication."** Coincidental duplication is two blocks that read alike
  today but answer different questions and change for different reasons — a shipping address validator and a
  billing address validator may share a shape by accident. Merge them and the next requirement that applies to
  only one forces an `if isBilling` branch into code that was supposed to be simple. If it isn't the same
  knowledge, let it stay duplicated.
- **"Fix it on sight."** The **rule of three**: tolerate the second occurrence, extract on the third, once the
  shape of the real abstraction is visible. Abstracting after one repeat guesses at a shape you don't have
  evidence for yet.
- **"DRY is about line count."** A one-line rule copy-pasted twice is a DRY violation; a hundred lines of
  boilerplate that never changes together is not — DRY tracks knowledge, not character count.

## References

- Hunt, A. & Thomas, D., *The Pragmatic Programmer* — [DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- Fowler, M. — [Beck's design rules](https://martinfowler.com/bliki/BeckDesignRules.html)
