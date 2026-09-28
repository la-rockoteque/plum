# Red, Green, Refactor

> Make it work, then make it right. The tests are what let you do the second part without fear.

## The problem

A new rule arrives: an order that has already shipped can no longer be cancelled. Two bad ways to add it: change
the code first and hope it's covered by whatever tests already exist, or add the rule and never revisit the shape
of the fix. The first risks shipping a rule nothing pins in place. The second risks a codebase that works by
accident and is expensive to touch next time.

## The idea

Test-Driven Development splits "does it work" from "is it well-designed" into two separate, small steps, repeated
in a short cycle:

1. **Red** — write a test for the behaviour you want. It fails, because the behaviour doesn't exist yet.
2. **Green** — write the smallest change that makes it pass. Crude is fine. The goal is only "true".
3. **Refactor** — with the test now protecting you, clean up the design. The test must still pass, unchanged.

```text
red:      test wants "shipped orders can't cancel" ──► fails (rule missing)
green:    smallest guard added                     ──► test passes (crude is fine)
refactor: guard becomes a named rule                ──► same test still passes
```

The cycle is deliberately small: one rule, one test, one minimal change, one cleanup. Large batches of "add
everything, then test it" skip the part of the discipline that keeps each step cheap to verify.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| The new requirement | "a shipped order can't be cancelled" | A rule described in a ticket or review comment with no matching test yet |
| The red test | a test asserting today's behaviour, named for the flaw | A test whose name states a problem, not a success |
| The guard | the minimal, crude fix | An inline comparison duplicated at each call site instead of named once |
| The refactor | the same rule, given a name and one home | A method or type that states the rule instead of restating the check |
| The safety net | the test suite, unchanged across green → refactor | Tests that still pass after a refactor with no edits to the tests themselves |

## Walk the stages

1. **red** — the module has no rule yet: cancelling a shipped order still succeeds. In a real cycle you would
   write this test *first*, watch it fail, and only then reach for stage 2. This library can't ship a failing
   test, so this stage's test instead pins the flaw by asserting the current, undesired outcome — its name says
   so. Read it as "here is the gap the next stage closes."
2. **green** — a guard appears exactly where the decision is made, phrased as directly as possible (a bare status
   comparison). It is not elegant, and that is fine: the only job of this stage is to turn the red assertion into
   a green one. Notice what didn't change: nothing about the rest of the module moved.
3. **refactor** — the same guard becomes a named concept (a `canCancel()` query, an explicit status enum). Behaviour
   is identical to green: the same two cases — a pending order still cancels, a shipped order still doesn't — are
   asserted again, unchanged, against the new shape. That repetition is the point: the tests are the proof that
   refactoring didn't quietly change what the code does.

## Trade-offs / when not to

Writing the test first has a cost: it's slower per line than writing the fix directly, and it asks for discipline
when the fix looks "obviously" correct. For a one-off script or throwaway exploration, skip it. For anything that
will be read, changed, or relied on again — which is most production code — the cycle pays for itself the first
time a change needs to prove it didn't break something else.

## Common misconceptions

- **"TDD means writing all the tests up front."** It means writing *one* test, then the smallest code to satisfy
  it, then repeating. Tests accumulate one cycle at a time, not as a batch before coding starts.
- **"The refactor step is optional if the green code already works."** Skipping it is how "temporary" crude
  guards become permanent. The tests exist specifically so refactoring is safe, not so it can be deferred forever.
- **"A red test is the same as a broken build."** A red test is a *design decision made visible*: it names the
  behaviour you're about to build before you build it.
- **"Green means done."** Green means correct. Refactor is what makes it also maintainable.

## References

- Kent Beck, *Test-Driven Development: By Example* (Addison-Wesley, 2002).
- Martin Fowler, [Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html).
- Martin Fowler, [Beck Design Rules](https://martinfowler.com/bliki/BeckDesignRules.html).
