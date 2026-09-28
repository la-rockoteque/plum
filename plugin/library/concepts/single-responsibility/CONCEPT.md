# Single Responsibility Principle

> A class should have only one reason to change — one actor whose requests it answers, not literally one method.

## The problem

A class grows one method at a time. Each addition is small and reasonable on its own: the cancellation rule needs
a guard clause, the confirmation email needs a line of text, the audit trail needs one more field. Nobody decided
to build a class with three jobs — it accreted. Now three different stakeholders can each ask for a change, and
each one's change risks breaking the other two: legal changes what the audit entry must record, marketing changes
the wording of the confirmation email, and product changes when an order is eligible for cancellation. All three
changes land in the same file, get reviewed by people who understand only one of the three concerns, and are
covered by tests that must be re-run (and often rewritten) no matter which of the three changed.

## The idea

"Do one thing" is a popular gloss on SRP, but it's imprecise — nearly any method can be described as doing "one
thing" at some level of abstraction. The precise version, from Robert C. Martin: a module should have one, and
only one, reason to change — one actor or stakeholder group whose concerns it serves. Group code by who asks for
changes to it, not by how many statements it takes to describe.

```text
before:  OrderService ─── cancellation rule
              │      ─── email wording
              │      ─── audit format
              (one class, three actors, three reasons to change)

after:   CancelOrder ───► OrderNotifier   (email wording — its own reason to change)
              │      ───► AuditLog        (audit format — its own reason to change)
              (cancellation rule stays; the other two concerns move to their own owners)
```

The use case that owns the business rule keeps only that rule. Everything a *different* stakeholder cares about
moves to a collaborator that owns just that concern.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Overloaded class | `OrderService` (before) | A `*Service`/`*Manager` whose methods mix a business rule with formatting, persistence, or notification |
| Policy that owns one rule | `CancelOrder` (after) | A use case whose only job is the rule its name promises |
| Message-formatting collaborator | `OrderNotifier` | Anything producing user- or ops-facing text: emails, notifications, reports |
| Record-keeping collaborator | `AuditLog` | Anything writing an audit trail, metrics, or a log line in a fixed format |

## Walk the stages

1. **before** — `OrderService.cancel()` checks the business rule, builds the confirmation email, and appends the
   audit line, all in one method. Read the tests: one test exercising the cancellation rule also has to assert
   the exact email wording and the exact audit line, because there is no way to trigger the rule without also
   producing the other two outputs. Change the email's wording and you edit `OrderService` — the same class, and
   the same test, that own the cancellation rule.
2. **after** — `CancelOrder` checks the rule and delegates to `OrderNotifier` and `AuditLog` through the notifier
   and audit ports it declares. Its own tests pass spies satisfying those ports and assert only the
   `(orderId, reason)` tuple the spy recorded — never the wording or format. `OrderNotifier` and `AuditLog` each
   have their own tests that assert the exact wording and format, with no mention of the cancellation rule. Change
   the email's wording now and only `OrderNotifier` and its test are touched; `CancelOrder`'s spy-based tests keep
   passing untouched.

## Trade-offs / when not to

Splitting has a cost: more files, more indirection, more collaborators to wire up. It pays off when the concerns
really do change for different reasons, at different times, requested by different people. It doesn't pay off for
a concern that will only ever have one implementation and one reason to change — merging a tiny formatting helper
back into its only caller is not a violation of SRP, it's avoiding a false split. Watch for over-splitting: giving
every three-line helper its own class produces indirection without an actor who benefits from it.

## Common misconceptions

- **"One thing" means one method, one line, or one calculation.** SRP is about reasons to change (actors), not
  the size or count of an implementation's steps. A class with a single 40-line method can violate SRP; a class
  with five short methods can honor it, if all five serve the same actor.
- **Cohesive helper methods inside one class are automatically a violation.** Private methods that all serve the
  same public responsibility (parsing the same input several ways, say) are fine — SRP is about the actors the
  *class* answers to, not about method count.
- **SRP means "small classes."** Smallness is a frequent side effect, not the goal. A large class with one actor
  is more SRP-compliant than three tiny classes each serving the same actor for no reason but line count.

## References

- [SOLID](https://en.wikipedia.org/wiki/SOLID) — Wikipedia overview of the five principles, including SRP.
- Robert C. Martin, ["The Single Responsibility Principle"](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html) —
  the "reasons to change" / actor framing this narrative follows.
