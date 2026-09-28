# Dependency Injection vs Dependency Inversion

> Injection is about *who constructs*. Inversion is about *who owns the abstraction*.

## Two different ideas

**Dependency Injection (DI)** is a construction technique: an object receives what it needs from its caller
instead of creating it.

**Dependency Inversion Principle (DIP)** is about source dependencies: high-level policy and low-level details
both depend on an abstraction, and the abstraction is owned by — and phrased for — the policy.

Injecting a concrete class is DI but not DIP: the business code still names an infrastructure type. Adding an
interface is not enough either; *where it lives* and *which types it exposes* are what matter.

## Three stages

| Stage | Who creates the dependency? | What does the use case's source depend on? |
|---|---|---|
| before | the use case | concrete infrastructure type |
| injection | the caller | concrete infrastructure type |
| inversion | the composition root | an application-owned contract |

```text
before / injection:   UseCase ───► ConcreteAdapter
inversion:            UseCase ───► Port ◄─── ConcreteAdapter
                                        ◄─── TestDouble
```

Runtime calls still flow from the use case to the adapter. DIP changes which *source types* the policy knows,
not the direction of the call.

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| High-level policy | `WelcomeUser` | Code that states business intent |
| Port | `Notifier.send(message)` | An interface declared next to the policy — or missing |
| Detail / adapter | `ConsoleNotifier` | Email/SMS/queue/HTTP clients, loggers, clocks, file systems |
| Test double | `RecordingNotifier` | Fakes that make effects observable |
| Composition root | demo entry point | `main`, app bootstrap, DI container config, framework module setup |

## Walk the stages

1. **before** — find the `new` inside the use case.
2. **injection** — construction moved out; the parameter still names the concrete type. Ask: could this use
   case compile without the infrastructure package?
3. **inversion** — the application declares the contract; adapters satisfy it; only the composition root knows
   both sides. Swap console ↔ recording: the use case doesn't change.
4. Read the tests: the recorder makes the exact message observable, failures propagate, invalid input sends
   nothing.

## Language notes

Nominal languages (C#, Kotlin, Java) implement interfaces explicitly. Go interfaces are satisfied implicitly and
idiomatically declared by the *consumer*. Python `Protocol` and TypeScript types are structural, so even the
"injection" stage can accept look-alikes — the improvement is removing the infrastructure import and moving the
contract to the application, not unlocking a runtime capability.

## When to stop

Constructor injection needs no framework. Reach for a container when construction and lifetime management
become substantial. An abstraction over a stable detail you will never replace or isolate is cost without
benefit; direct use is fine.

## Common misconceptions

- "DI container = dependency inversion." A container automates injection; ownership of abstractions is a design
  decision it can't make for you.
- "Every class needs an interface." Only boundaries you need to swap or isolate.
- "Service locators are DI." A use case that resolves its own dependencies from a global has hidden coupling.
