# Coupling and Cohesion

> Coupling asks how much one part of a system has to know about another. Cohesion asks how well the things
> inside one part belong together.

## The problem

A service that needs to make a customer-specific decision reaches directly into the customer's fields to make
it — a tier code, a spend total, how long they've been a member — and works the rule out itself. That reads
fine the first time. The second time the service needs the same decision (a receipt line, a different report),
it's tempting to copy the rule rather than call back into the first copy. Now the interpretation of "what this
customer is worth" lives in two places inside a class that isn't about customers at all, and both need to agree
forever.

This is a classic **feature envy** smell: a method that is more interested in another object's data than its
own. It is also, at the design-quality level, low **cohesion** — the service now bundles "run the checkout" with
"interpret loyalty tiers," two responsibilities that don't belong together — and high **coupling** — the service
cannot change how it prices anything without knowing exactly how `Customer` represents tier, spend and
membership length internally.

## The idea

**Coupling** is the degree to which one module depends on another — how much of module B's internals module A
needs to know to do its job. **Cohesion** is how closely related the responsibilities inside a single module
are. The two move together: pulling a responsibility out of a module that didn't own it usually raises the
cohesion of *both* modules and lowers how much either has to know about the other.

```text
before:  OrderService ──reads tier, spend, years──► Customer
                       ──reads tier, spend, years──► Customer   (again, in a second method — and it drifts)

after:   OrderService ──cancellationDiscount()──► Customer
```

The fix isn't "fewer method calls between classes" — the call from `OrderService` to `Customer` still happens
after the fix, and that's fine. What changed is *what* crosses the boundary: a question ("what discount do you
give?") instead of three raw fields the caller has to interpret itself. Structured-design's original vocabulary
named several finer-grained flavours of coupling (data, stamp, control, common, content); more recently
*connascence* gives it an even more precise vocabulary — types of connascence (name, type, meaning, position,
algorithm) and their strength — worth reaching for if a design discussion needs more precision than "coupled."

## Roles — find them in any codebase

| Role | Canonical example | What to look for in a real repo |
|---|---|---|
| Envious collaborator | `OrderService` | A class whose method reads several fields of one other object to decide something |
| Data owner | `Customer` | The object whose fields are being read — and, after the fix, whose method answers the question |
| Narrow collaboration point | `cancellationDiscount()` | A method named after the question being asked, not the fields it uses |
| Scattered knowledge | the duplicated tier rule | The same interpretation of one object's data, copied into a second method or class |

## Walk the stages

1. **before** — `OrderService.cancellationFee` reaches into `Customer.tier`, `Customer.lifetimeSpend` and
   `Customer.yearsAsMember` to work out a discount, then `OrderService.loyaltyDiscount` does the same
   interpretation again for a different caller. The test at the spend boundary shows the two copies have
   already drifted (`>=` in one place, `>` in the other) — the same customer prices out to two different
   discounts depending on which method you ask.
2. **after** — `Customer.cancellationDiscount()` is the one place that turns tier, spend and membership length
   into a discount. Both `OrderService` methods just call it. The boundary test now agrees, and it agrees
   *because* there's only one rule left to disagree with itself.

## Trade-offs / when not to

Zero coupling is not the goal — collaboration is the goal, and every collaboration is some coupling. `Order`
still calls `Customer`; the fix changed what it asks for, not whether it asks. Pushing every rule that
mentions a field onto the object that owns the field can go too far the other way: a `Customer` that grows a
method for every caller's slightly different pricing need becomes its own kind of low-cohesion god class.
Reaching into one field to log it, or comparing two values a caller was already handed, isn't envy — moving
that behind a method would be ceremony for its own sake.

## Common misconceptions

- **"Fewer calls between classes is always better."** Meaningful collaboration is the point of having more than
  one class. The measure is what's exposed across the call, not how many calls there are.
- **"Getters make it decoupled."** A getter for every field and a caller that reads three of them to make a
  decision is exactly the coupling this concept is about — the accessor didn't hide anything.
- **"Duplication and coupling are unrelated."** They compound each other: two copies of the same rule are two
  places that must change together, which is coupling by definition, even with no call between them at all.

## References

- Fowler, *Reducing Coupling*, IEEE Software — https://martinfowler.com/ieeeSoftware/coupling.pdf
- Refactoring Guru, *Feature Envy* — https://refactoring.guru/smells/feature-envy
