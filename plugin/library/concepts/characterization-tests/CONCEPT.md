# Characterization tests

> When you don't know what the code is supposed to do, write down what it actually does - then decide.

## The problem

Somewhere in most codebases sits a function nobody wants to touch: `computeRefund`, `calculateShippingCost`,
`resolveDiscount`. It has no tests. It has nested conditionals and numbers with no names. It has probably been
correct in production for years, or it has a subtle bug nobody has noticed, and there is no way to tell which from
reading it. Everyone is afraid to change it, because changing it with no tests means finding out what broke from a
support ticket instead of a red test. The fear is entirely reasonable: you cannot safely refactor code whose
current behaviour you cannot state.

## The idea

Before refactoring legacy code with no tests, write tests that describe what it **currently does** - not what it
should do, not what the ticket says it's supposed to do. Feed it a set of inputs, including the inputs that look
odd or wrong, run it, and assert on whatever it actually returns. These are sensing tests: they exist to detect
change, not to encode a specification. Name them for what they observe ("currently ...") rather than what they
require ("should ..."), because a "should" name asserts a decision about correctness that characterization tests
deliberately don't make yet.

Once the current behaviour - warts and all - is pinned by a passing test suite, the legacy code can be refactored:
extracted into named helpers, given named constants, restructured for clarity. The characterization tests run
against the refactor exactly as they ran against the original. If they still pass, the refactor changed nothing
observable. *Then*, and only then, is it time to look at any behaviour that turned out to be a bug and decide,
deliberately, whether to fix it - as its own change, with its own red-green-refactor cycle that updates the
characterization test to reflect the new intended behaviour.

```text
legacy code, no tests           →  characterization tests pin every       →  refactor the legacy code;
(nested ifs, magic numbers)        current output, odd ones included         same tests, still green

                                 →  (separately, later) decide whether
                                    an odd output is a bug; fix it with
                                    its own red-green-refactor step
```

## Roles - find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| The legacy operation | `computeRefund(order, todayMs)` | A function everyone avoids changing, with no tests in its history |
| Sensing variable | the characterization test table | Any test written to observe current output, not to specify required output |
| The odd behaviour | the 14/15-day refund boundary, the >30-day rounding | A rule with no comment explaining why it exists, found only by exercising the code |
| Golden master | the pinned expected value for each input | A specific number/string a test asserts on, derived by running the code, not by reasoning about a spec |
| The refactor target | named helpers and constants replacing bare conditionals | The same operation, same tests, clearer internal structure |

## Walk the stages

1. **before** - the legacy `computeRefund` exists exactly as found: nested `if`/`else`, magic numbers (`14`, `90`,
   `30`, `100`, `86400000`) with no names, no comments explaining any of the three rules it encodes. The single
   test at this stage does not describe those rules - it doesn't know them yet. It calls the function once, with
   one arbitrary input, and pins whatever comes out. That is the actual starting point of legacy work: you don't
   understand the function, you have one fact about it, and that's all you have until you look closer.
2. **after** - two things happen together. First, a table of characterization tests, each named "currently ...",
   pins the function's real output for a set of inputs chosen because they exercise every distinct rule: a `hold`
   status, the exact boundary day where the refund percentage drops, the exact boundary day where rounding starts,
   and a case where that rounding actually changes the number. Second, a refactored implementation replaces the
   bare comparisons with named constants and named helper functions - `ageInDays`, `baseRefundMinor`,
   `roundDownIfStale` - one small function per rule. The *same* table of tests runs against both the untouched
   legacy code and the refactored code, and both must produce identical output for every row. That equality, not
   a code review of the refactor, is what proves the redesign preserved behaviour.

## Trade-offs / when not to

Characterization tests cost effort for no immediate design payoff: you spend time pinning behaviour that might
turn out to be wrong, and the tests themselves read oddly ("currently refunds 90 percent" is not a requirement
anyone chose). Skip this ceremony when the legacy code is small enough to read and rewrite from scratch with
confidence, or when nobody depends on its current behaviour ever being preserved. Reach for it when the function
is large, poorly understood, still relied upon, and touching it without a safety net has real cost if something
breaks.

## Common misconceptions

- **"Characterization tests are just tests I forgot to write earlier."** A test written against a spec asserts
  what the code *should* do. A characterization test asserts what the code *currently* does, including behaviour
  nobody would have chosen - that distinction is the entire point, not an accident of timing.
- **"An odd output found this way is automatically a bug to fix."** It might be a deliberate rule nobody documented,
  or years of production behaviour customers now depend on. Characterizing pins it in place so a decision can be
  made deliberately, later - it does not make that decision for you.
- **"Once I've characterized it, I should also fix what looks wrong while I'm in there."** Fixing and refactoring
  are different changes with different risk profiles. Refactoring under characterization tests promises "nothing
  observable changed"; silently changing a pinned value while "cleaning up" breaks that promise and defeats the
  reason the tests exist. A real fix gets its own red-green-refactor cycle, with the characterization test updated
  to state the new expected behaviour.
- **"This is the same as a snapshot/golden-master test forever."** It's a scaffold for a specific refactor, not a
  permanent substitute for tests that encode real requirements. Once the code is understood and cleaned up, later
  tests can - and should - start asserting *should*, not just *currently*.

## References

- Michael Feathers, *Working Effectively with Legacy Code* (Prentice Hall, 2004) - the book that coined the term.
- Wikipedia, [Characterization test](https://en.wikipedia.org/wiki/Characterization_test).
- Michael Feathers, [On Characterization Testing](https://michaelfeathers.silvrback.com/characterization-testing).
