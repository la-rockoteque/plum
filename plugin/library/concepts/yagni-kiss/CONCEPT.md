# YAGNI and KISS

> You aren't gonna need it — and the simplest thing that works beats the cleverest thing that might.

## The problem

A repository grows a `CancellationPolicy` interface, a factory that resolves policies by a config string, an
`onBeforeCancel`/`onAfterCancel` hook list, and a `strictMode` flag — all built "for later," in case a second kind
of order needs a different cancellation rule someday. Today there is exactly one policy, no caller ever registers
a second one, both hook lists are empty at every call site, and the flag is never set to anything but its
default. None of this is wrong, exactly — it all compiles, it all technically works — but it is all cost with no
buyer. Every one of those seams is something the next person has to read, understand, and decide is safe to leave
alone before they can find the one line that actually decides whether an order can be cancelled.

## The idea

Build only what the one real, current case needs. If a policy has one implementation, it doesn't need an
interface; if nothing registers a second entry, a registry is a dictionary with a decorative API; if a hook list
is always empty, it isn't an extension point, it's dead weight with a `for` loop attached. KISS is the same idea
from the other direction: prefer the plain version until something concrete forces the clever one. Deleting the
speculative machinery down to what is actually called shouldn't change behavior at all — the same before/after
test cases should still pass, with far less standing between the reader and the rule.

```text
before:  OrderCancellationService --(resolves via)--> CancellationPolicyRegistry --(looks up)--> "standard" -> the only policy
                                  --(runs, always empty)--> CancellationHooks
                                  --(carries, never read)--> strictMode

after:   Order.canBeCancelled(clock)   # the one rule, the only thing that was ever called
```

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| The abstraction built for later | `OrderCancellationService` + `CancellationPolicyRegistry` | An interface/factory/registry combo introduced "for extensibility" with no second consumer in the diff that added it |
| The only real implementation | `StandardCancellationPolicy` | A `Base*`/`Abstract*`/`I*` type with exactly one concrete subclass anywhere in the codebase |
| The dead extension point | `CancellationHooks` | Callback/hook lists that are empty at every call site — `grep` for the registration call and find none |
| The unused config | `strictMode` | A flag threaded through constructors that is read in zero places, or set nowhere but its own default |

## Walk the stages

1. **before** — read `OrderCancellationService`. Cancelling an order means resolving a policy out of a registry
   keyed by a string, running two hook lists that are always empty, and carrying a `strictMode` flag that nothing
   reads. Getting a policy by name pays off only if a second policy ever exists; it doesn't. The tests show the
   toll directly: to check one rule, a test has to construct a registry and a service and reason about hooks that
   do nothing. One test pins down a real cost of this shape: a typo in the policy name (`"stadnard"` for
   `"standard"`) doesn't fail — the registry's `.get(..., default)` fallback swallows it silently and resolves
   to the one real policy anyway, so a misconfigured deploy behaves identically to a correct one — nothing ever
   signals that the config value was wrong.
2. **after** — everything but the rule is gone. `Order.canBeCancelled(clock)` is the whole feature. The same three
   behavioural cases (fresh pending order, order past the window, shipped order) hold on both stages — nothing
   about *what the software does* changed, only how much of it there is to read, test and maintain.

## Trade-offs / when not to

Deleting an abstraction is not free reverse-insurance either — the goal isn't zero structure, it's structure
earned by evidence. Build the seam back when there is a **second real, currently-needed case**, not a
hypothetical one: a second policy an actual caller needs today, not "the sales team might want tiered refunds
eventually." The **rule of three** applies to abstractions as much as to duplicated code — tolerate the second
occurrence, generalize on the third, once you have two real shapes to generalize *from* instead of guessing at
one. And some seams are earned even at one implementation: if the only way to unit-test a use case in isolation
is to swap the concrete infrastructure for a test double, that seam is dependency inversion, not speculation — see
`dependency-inversion` for how to tell "a seam I need to test this" from "a seam I might need someday." YAGNI and
`open-closed` are counterweights, not opposites: an extension point earns its place only once a real second
variant exists, and until then the two principles agree that the plain, ungeneralized version is the right one.

## Common misconceptions

- **"YAGNI means don't design."** YAGNI is about not building speculative *generality* — extra parameters, hooks,
  and configuration paths for cases that don't exist yet. It says nothing against thinking through the shape of
  the one case you do have; a well-designed simple thing is still the goal.
- **"KISS means skip the tests, or skip refactoring."** Keeping something simple is not the same as keeping it
  untested or never revisiting it. The simplest version that works still needs a test proving it works, and still
  gets refactored when the *next* real requirement lands — simplicity is a property of the current design, not a
  license to stop maintaining it.
- **"If we don't build the hook now, we'll have to do a big rewrite later."** The `after` stage here is smaller and
  easier to extend than the `before` stage, not harder: a real second policy is one new method away, because
  there's no wrong-shaped registry or wrong-shaped hook contract to unwind first. Speculative generality guesses at
  a shape; deleting it and waiting for a real second case gets the shape right when it's finally needed.

## References

- Fowler, M. — [Yagni](https://martinfowler.com/bliki/Yagni.html)
- Fowler, M. — [Beck's design rules](https://martinfowler.com/bliki/BeckDesignRules.html)
