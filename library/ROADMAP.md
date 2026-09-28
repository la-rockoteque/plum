# Concept library roadmap

Plan for growing the library from the 5 imported backend concepts to ~60 across principles, testing, architecture,
frontend, infra, refactoring and security. Every entry must fit the library's format: a small **runnable
before → after** (≤ ~150 lines per language per stage, no external services — in-memory fakes or SQLite), a
`roles` map so Claude can bind it to any repo, `signals` to detect it, and explain-back `checks`.

Research date: 2026-09-28. References were fetched and checked except those marked †.

## Guiding decisions

- **Keep the order domain.** Backend, principles, testing, architecture, security and infra concepts all extend
  *cancel an order*. Learners compare concepts, not domains; Claude does the domain binding at teaching time.
- **Stretch the order domain to the other tracks instead of inventing new ones:**
  - **Frontend** — the *order line-item editor*: edit a pending order's lines (quantity stepper, remove line,
    coupon, live subtotal) and cancel it. It still needs derived state, a server/local state split, optimistic UI
    and form validation, and the backend concepts' `Order` is the thing on screen.
  - **Infra** — *operate the order service*: the existing service as the deployable unit plus one flaky in-process
    payment-gateway fake for resilience patterns.
- **SOLID as four concepts** (S, O, L, I). D already exists as `dependency-inversion`. Each letter has its own smell,
  refactor and quiz question.
- **Merge near-duplicates rather than teach the same code twice** (see "Merged or rejected").

## Library changes needed

| Change | Needed by |
|---|---|
| `examples/react/` — Vite + React 19 + TypeScript, Vitest + Testing Library, order line-item editor against an in-memory API | Frontend track (wave 4) |
| `examples/infra/` — Dockerfile, GitHub Actions YAML, Terraform (plan-only, null/local provider), shell checks | Infra wave 3 and wave 5 |
| Allow a concept to list only the languages it fits (the manifest already supports this; the teach skill falls back to the closest paradigm) | Frontend, infra |
| Map concepts to Plum skill domains in `concept.json` (`domain: implementation \| debugging \| testing \| architecture \| synthesis`) so nudges can suggest `/plum:teach <id>` for at-risk domains | Wave 1 |
| CI job running all example suites (Python, .NET, TS, Go, Kotlin, later React) | Before wave 1 grows the projects |

## Waves

| Wave | Theme | Concepts | Why this order |
|---|---|---|---|
| 1 | Principles + DDD tactical + TDD on the order domain | SRP, OCP, DRY, coupling-cohesion, law-of-demeter, tell-dont-ask, composition-over-inheritance, value-objects-entities, aggregates, domain-events, red-green-refactor, test-doubles, testing-through-public-api | Foundations everything else cites; direct extensions of `Order`; existing test suites already illustrate the testing ones |
| 2 | Remaining principles, testing depth, architecture styles, core refactorings | LSP, ISP, yagni-kiss, test-pyramid-vs-trophy, characterization-tests, layered-architecture, ports-and-adapters, api-design-versioning, idempotency, seams, extract-function-class, replace-conditional-with-polymorphism | Builds on wave 1; OCP's before-code is reused by replace-conditional |
| 3 | Event-driven, security, infra foundations | bounded-contexts, event-driven-architecture, outbox, anti-corruption-layer, input-validation-boundaries, authn-vs-authz, sql-injection, idor, twelve-factor-config, containerization, ci-pipeline, health-checks, secrets-management | Outbox builds on `unit-of-work`; security stays in-process with SQLite |
| 4 | Frontend track (new example project), advanced architecture and resilience | the 13 frontend concepts, saga, cqrs-separate-stores, modular-monolith, vertical-slices, observability, circuit-breaker-retry-timeout, caching-strategies, feature-flags, strangler-fig, contract-tests, property-based-testing, least-privilege | Needs `examples/react/`; saga needs outbox |
| 5 | Stretch: hardest to show honestly in-process | blue-green-canary-deploy, infrastructure-as-code, immutable-infrastructure, rendering-strategies, optimistic-ui, design-tokens | Simulated; first to cut if the library is capped |

Stages default to **before → after**; a third stage is listed where the middle step is itself the lesson (as in
`dependency-inversion`'s *injection only*).

## Principles

| id | level | stages (order domain) | prereqs | signal | reference |
|---|---|---|---|---|---|
| `single-responsibility` | foundation | `OrderService` cancels, formats the email and writes the audit log → three collaborators | — | a file changes for unrelated reasons (divergent change) | [SOLID](https://en.wikipedia.org/wiki/SOLID) |
| `open-closed` | foundation | `switch (order.type)` for cancellation fees → one strategy per type; a new type edits nothing | single-responsibility | the same type switch repeated across files | [SOLID](https://en.wikipedia.org/wiki/SOLID) |
| `liskov-substitution` | intermediate | `GiftOrder.cancel()` throws "not supported" → capability modelled by composition | single-responsibility | overrides that throw or no-op; callers doing `instanceof` | [SOLID](https://en.wikipedia.org/wiki/SOLID) |
| `interface-segregation` | intermediate | fat repository (CRUD + audit + export) → focused ports; the test fake shrinks | single-responsibility, repository | fakes full of `NotImplemented` | [SOLID](https://en.wikipedia.org/wiki/SOLID) |
| `dry` | foundation | cancel-eligibility rule copy-pasted in CLI and API → one domain method (and when duplication is fine) | — | a bug fix edits the same rule in two places | [Pragmatic Programmer, DRY](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)† |
| `yagni-kiss` | foundation | repository with unused strategy hooks and dead config → deleted to what is called | dry | an abstraction with exactly one implementation and no second caller | [Yagni](https://martinfowler.com/bliki/Yagni.html) |
| `coupling-cohesion` | foundation | `OrderService` reaches into `Customer` internals for a discount → behaviour moves to its owner | — | feature envy; long parameter lists of one object's fields | [Feature envy](https://refactoring.guru/smells/feature-envy)† |
| `composition-over-inheritance` | intermediate | `Order → RushOrder → RushGiftOrder` overrides undoing parents → composed policies | liskov-substitution | inheritance depth > 2; overrides that skip the parent | [Composition over inheritance](https://en.wikipedia.org/wiki/Composition_over_inheritance)† |
| `law-of-demeter` | intermediate | `order.customer().address().city()` → a question `Order` answers | coupling-cohesion | getter chains three deep | [Law of Demeter](https://en.wikipedia.org/wiki/Law_of_Demeter) |
| `tell-dont-ask` | intermediate | caller checks `order.status` then mutates → `order.cancel()` owns the rule | law-of-demeter | a getter immediately followed by caller-side branching | [TellDontAsk](https://martinfowler.com/bliki/TellDontAsk.html) |

## Testing & TDD

| id | level | stages | prereqs | signal | reference |
|---|---|---|---|---|---|
| `red-green-refactor` | foundation | failing test for "can't cancel a shipped order" → minimal guard → refactor (three stages) | — | production changes with no test in the same commit | [TDD](https://martinfowler.com/bliki/TestDrivenDevelopment.html)† |
| `test-doubles` | foundation | notifier test hits a real SMTP client → dummy, stub, spy, mock and fake, each named for its role | red-green-refactor, dependency-inversion | unit tests opening sockets or DB connections | [TestDouble](https://martinfowler.com/bliki/TestDouble.html) |
| `testing-through-public-api` | intermediate | test inspects private state and mocks internals → drives `cancel()` and asserts observable state | test-doubles | tests importing internals; mocks of the unit's own collaborators | [TestDouble](https://martinfowler.com/bliki/TestDouble.html) |
| `test-pyramid-vs-trophy` | intermediate | the same feature at unit, integration and E2E level → a rebalanced suite with a cost/confidence table | test-doubles | CI time dominated by a few slow E2E specs | [TestPyramid](https://martinfowler.com/bliki/TestPyramid.html), [Write tests](https://kentcdodds.com/blog/write-tests) |
| `characterization-tests` | advanced | untested legacy cancel logic → tests that pin current behaviour → safe refactor | red-green-refactor | "don't touch this" comments; untested hot files | [Characterization test](https://en.wikipedia.org/wiki/Characterization_test) |
| `contract-tests` | advanced | a hand-rolled payment-gateway mock drifts → one contract suite runs against the fake and the provider implementation | test-doubles | mocks of external services never checked against the real thing | [ContractTest](https://martinfowler.com/bliki/ContractTest.html) |
| `property-based-testing` | advanced | three example tests for order totals → properties (`total ≥ 0`, cancel is not re-entrant) over generated inputs | test-doubles | long lists of near-identical example tests | [What is PBT](https://hypothesis.works/articles/what-is-property-based-testing/) |

The library's own contract tests (the same storage checks run against both adapters in `repository`) are the
worked example for `contract-tests`; the narrative should point at them.

## Architecture

| id | level | stages | prereqs | signal | reference |
|---|---|---|---|---|---|
| `layered-architecture` | foundation | controller validates, cancels and runs SQL → controller → service → repository | — | SQL/ORM calls in controllers | [Presentation-domain-data](https://martinfowler.com/bliki/PresentationDomainDataLayering.html) |
| `ports-and-adapters` | intermediate | layered app whose domain imports drivers → driving and driven ports, adapters on both sides (HTTP + CLI in, SQLite + in-memory out). Covers Clean Architecture's concentric vocabulary as a variant | layered-architecture, repository, dependency-inversion | domain code importing framework or driver types | [Hexagonal](https://alistair.cockburn.us/hexagonal-architecture/), [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) |
| `vertical-slices` | intermediate | one `OrderService` for every operation → a `CancelOrder` slice and a `PlaceOrder` slice, each end to end | layered-architecture | a service class that grows a method per feature | [Vertical slice](https://www.jimmybogard.com/vertical-slice-architecture/) |
| `value-objects-entities` | foundation | `status: string` and `amount: number` → `OrderStatus` with legal transitions and `Money(amount, currency)` | — | primitives carrying domain rules; duplicated validation | [Vernon, Effective Aggregate Design](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf) |
| `aggregates` | intermediate | order lines updated directly, bypassing totals → `Order` root is the only entry point | value-objects-entities, repository | a child entity with its own repository | same |
| `domain-events` | intermediate | `cancel()` calls notification code inline → `cancel()` records `OrderCancelled`; a handler reacts | aggregates, unit-of-work | domain methods calling unrelated side effects | [DomainEvent](https://martinfowler.com/eaaDev/DomainEvent.html) |
| `bounded-contexts` | intermediate | one `Order` shared by fulfilment and billing with conflicting fields → two models and an explicit translation | value-objects-entities | the same class serving two subsystems with diverging fields | [BoundedContext](https://martinfowler.com/bliki/BoundedContext.html) |
| `event-driven-architecture` | intermediate | order calls inventory directly → `OrderCancelled` on an in-memory bus; inventory subscribes. Narrative covers Fowler's four meanings | domain-events | a producer importing its consumers | [What do you mean by event-driven](https://martinfowler.com/articles/201701-event-driven.html) |
| `outbox` | advanced | `save()` then `publish()` (crash in between loses the event) → status and outbox row in one transaction, then a poller publishes | event-driven-architecture, unit-of-work | DB write and message publish as two non-atomic steps | [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) |
| `saga` | advanced | cancel + refund across two in-process services with no rollback → orchestrated saga with a compensating step | outbox | multi-resource updates with no recovery path | [Saga](https://microservices.io/patterns/data/saga.html) |
| `idempotency` | intermediate | retrying `cancel` sends two refunds → idempotency key and a processed-requests table | unit-of-work | retries causing duplicate side effects | [Idempotent receiver](https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html) |
| `api-design-versioning` | foundation | a bespoke `/cancel` response changed in place → a consistent envelope, additive evolution, `/v2` only for breaking changes | layered-architecture | response shapes changed with no version marker | [roadmap.sh API design](https://roadmap.sh/api-design) (thin on versioning) |
| `anti-corruption-layer` | advanced | domain branches on a legacy gateway's cryptic codes → a translator returning the domain's `PaymentResult` | bounded-contexts | external enums and field names inside domain code | [ACL](https://microservices.io/patterns/refactoring/anti-corruption-layer.html) |
| `modular-monolith` | advanced | `orders` queries `payments` tables → modules own their schema and talk through a module API | bounded-contexts | cross-module imports of internal repositories; cross-context joins | [Modular monolith primer](https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer) |
| `cqrs-separate-stores` | advanced | follow-on to `cqrs`: `OrderCancelled` projects into a separate denormalised history store; the narrative covers lag and rebuilds | cqrs, domain-events | reporting joins hammering the write schema | [CQRS](https://martinfowler.com/bliki/CQRS.html) |

## Frontend (order line-item editor, `examples/react/`)

| id | level | stages | prereqs | signal | reference |
|---|---|---|---|---|---|
| `component-composition` | foundation | 300-line `OrderPage` → `LineList` › `OrderLine` › `QuantityStepper` | — | one component mixing fetch, logic and markup | [Passing props](https://react.dev/learn/passing-props-to-a-component) |
| `local-state` | foundation | a draft quantity pushed to a global store → `useState` in the line | component-composition | a global store for a value one component uses | [State](https://react.dev/learn/state-a-components-memory) |
| `lifted-state` | intermediate | line and summary each hold a quantity copy and drift → state lifted to the page | local-state | siblings holding copies of the same value | [Sharing state](https://react.dev/learn/sharing-state-between-components) |
| `derived-state` | foundation | subtotal kept in state and synced by an effect → computed during render | local-state | an effect whose only job is `setState` | [You might not need an effect](https://react.dev/learn/you-might-not-need-an-effect) |
| `controlled-vs-uncontrolled` | foundation | `defaultValue` + ref → controlled input that clamps as you type | local-state | `value` and `defaultValue` mixed; reading `ref.current.value` | [`<input>`](https://react.dev/reference/react-dom/components/input) |
| `effects-data-fetching` | intermediate | fetch without cleanup shows a stale-response bug → effect with abort/ignore cleanup | derived-state | fetch in effects with no cleanup | [Synchronizing with effects](https://react.dev/learn/synchronizing-with-effects) |
| `server-state` | intermediate | hand-rolled loading/error flags per component → one `useOrder()` cache boundary (then TanStack Query) | lifted-state, effects-data-fetching | copy-pasted fetch + useState boilerplate | [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) |
| `custom-hooks` | intermediate | `OrderContainer` / `OrderView` split → logic in `useOrder()`, view as a pure function of props | effects-data-fetching | Container/View pairs; data-only HOCs | [Reusing logic](https://react.dev/learn/reusing-logic-with-custom-hooks), [Container pattern](https://www.patterns.dev/react/presentational-container-pattern/) |
| `accessibility-basics` | foundation | `<div onClick>` stepper with no label → real buttons, labels and a live region; tests query by role | component-composition | clickable divs; unlabeled inputs | [web.dev a11y](https://web.dev/learn/accessibility), [ByRole](https://testing-library.com/docs/queries/byrole/) |
| `form-validation` | foundation | coupon errors only from the server → constraint validation and inline errors (explicitly not a security boundary) | controlled-vs-uncontrolled, input-validation-boundaries | submit handlers with no constraints | [web.dev forms](https://web.dev/learn/forms/validation) |
| `design-tokens` | intermediate | hex values and magic pixels in components → tokens as CSS custom properties | component-composition | the same visual value spelled several ways | [Design Tokens CG](https://www.w3.org/community/design-tokens/) |
| `optimistic-ui` | advanced | "remove line" and "cancel order" wait on a spinner → immediate update with `useOptimistic`, rolled back when the API rejects (e.g. already cancelled) | server-state | spinners on every mutation; ad-hoc revert code | [useOptimistic](https://react.dev/reference/react/useOptimistic) |
| `rendering-strategies` | advanced | the same page rendered client-only, per request and at build time by plain functions; the outputs and hydration points compared | component-composition | content pages shipping only a client bundle; hydration warnings | [Rendering on the web](https://web.dev/articles/rendering-on-the-web) |

Vue and Svelte equivalents (slots, `computed`/`$derived`, composables, `$effect`) go in each narrative's language
notes; one runnable framework is enough.

## Infra / DevOps (operate the order service)

| id | level | medium | stages | prereqs | signal | reference |
|---|---|---|---|---|---|---|
| `twelve-factor-config` | foundation | code | hard-coded hosts and `if env == "prod"` → validated config from the environment, failing fast at startup | — | connection strings in source | [12-factor config](https://12factor.net/config) |
| `secrets-management` | intermediate | code | a key literal or committed `.env` → a `SecretProvider` port with an in-memory fake | twelve-factor-config, dependency-inversion | high-entropy literals; secrets in git history | [OWASP secrets](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) |
| `health-checks` | foundation | code | no status endpoint → liveness vs readiness, with readiness checking the DB | — | no `/health` in the service or orchestrator config | [Health check API](https://microservices.io/patterns/observability/health-check-api.html) |
| `containerization` | foundation | Dockerfile | README setup steps → a multi-stage Dockerfile for the TS example | — | manual multi-step setup | [What is a container](https://www.docker.com/resources/what-container/) |
| `ci-pipeline` | foundation | GitHub Actions | "remember to run tests" → workflow running tests and typecheck on every push | — | no workflow files | [Continuous integration](https://martinfowler.com/articles/continuousIntegration.html) |
| `feature-flags` | foundation | code | commented-out new behaviour → a flag store port; release separated from deploy | dependency-inversion | commented-out blocks; "enable after release" TODOs | [Feature toggles](https://martinfowler.com/articles/feature-toggles.html) |
| `observability` | intermediate | code | scattered prints → structured logs plus golden-signal counters asserted in a test (single-service stand-in for tracing) | — | print debugging in production paths | [SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/) |
| `circuit-breaker-retry-timeout` | intermediate | code | unbounded `while true: retry` to the flaky gateway → timeout, bounded backoff, breaker (closed/open/half-open) | health-checks | network calls with no timeout | [CircuitBreaker](https://martinfowler.com/bliki/CircuitBreaker.html) |
| `caching-strategies` | intermediate | code | unbounded memo dict → cache-aside with TTL and explicit invalidation on cancel | — | "returns old value after update" bugs | [Caching challenges](https://aws.amazon.com/builders-library/caching-challenges-and-strategies/) |
| `infrastructure-as-code` | intermediate | Terraform (plan only) | click-ops runbook → `.tf` with a local/null provider; the lesson is the `plan` diff | twelve-factor-config | manual provisioning docs | [InfrastructureAsCode](https://martinfowler.com/bliki/InfrastructureAsCode.html) |
| `immutable-infrastructure` | intermediate | Dockerfile + script | a script mutating a running container → rebuild the tagged image and replace it | containerization | SSH or config-management edits on live hosts | [ImmutableServer](https://martinfowler.com/bliki/ImmutableServer.html) |
| `blue-green-canary-deploy` | advanced | code (simulator) | stop-then-start deploy → an in-memory router with two versioned backends: `route`, `ramp`, `rollback`, asserted by traffic split | ci-pipeline, health-checks | deploy scripts that stop the only instance | [BlueGreen](https://martinfowler.com/bliki/BlueGreenDeployment.html), [Canary](https://martinfowler.com/bliki/CanaryRelease.html) |

## Refactoring & legacy

| id | level | stages | prereqs | signal | reference |
|---|---|---|---|---|---|
| `seams` | foundation | reuses `dependency-inversion` code, framed for legacy: the hard-wired `new` is the missing seam; injection creates one | dependency-inversion | tests skipped because they "hit the real network" | [Feathers key points](https://understandlegacycode.com/blog/key-points-of-working-effectively-with-legacy-code/) |
| `extract-function-class` | foundation | a 100-line `cancelOrder()` with comment sections → extracted, separately tested pieces | — | long methods; `validate*`/`send*`/`persist*` prefixes in one class | [Extract method](https://refactoring.guru/extract-method) |
| `replace-conditional-with-polymorphism` | intermediate | reuses `open-closed`'s before code; walks the refactoring step by step | open-closed | type switches in several places | [Refactoring.guru](https://refactoring.guru/replace-conditional-with-polymorphism) |
| `strangler-fig` | advanced | all calls hit `LegacyOrderService` → a router sends a configurable share to the new service; a test checks both paths agree | seams, characterization-tests | a god service; parallel implementations with no routing | [StranglerFig](https://martinfowler.com/bliki/StranglerFigApplication.html) |

## Security

| id | level | stages | prereqs | signal | reference |
|---|---|---|---|---|---|
| `input-validation-boundaries` | foundation | raw request string reaches the repository → allowlist schema validation at the handler | — | request params passed straight to data access | [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) |
| `sql-injection` | foundation | concatenated SQL leaks every row for `1' OR '1'='1` → parameterised query returns none (SQLite) | input-validation-boundaries | string-built SQL | [OWASP SQLi](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) |
| `authn-vs-authz` | foundation | "is logged in" gates cancel → a separate `canCancel(user, order)` policy | — | mutations checked only for authentication | [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) |
| `idor` | intermediate | cancel by ID alone lets any user cancel anyone's order → ownership-scoped lookup | authn-vs-authz | `findById` feeding a mutation with no scope | [OWASP IDOR](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) |
| `least-privilege` | intermediate | one `is_admin` flag grants cancel, refund and delete → fine-grained permissions, deny by default | authn-vs-authz | one broad role gating unrelated sensitive actions | [OWASP A01](https://owasp.org/Top10/2021/A01_2021-Broken_Access_Control/) |

## Hard to show in-process, and how to teach them anyway

| Concept | Constraint | Approach |
|---|---|---|
| saga, anti-corruption-layer | need a second system with its own failure modes or ugly model | an in-process fake service with injectable failures; a deliberately awkward fake gateway |
| bounded-contexts, modular-monolith | the payoff is organisational (teams, deploys) | teach the seam: two modules with no shared imports and explicit translation; the narrative covers the team side |
| blue-green/canary, IaC | need real environments or cloud credentials | an in-memory router simulator; `terraform plan` only, never `apply` |
| rendering-strategies | needs a server and build pipeline | render functions that stand in for request and build time; compare outputs |
| observability | real value is cross-service correlation | golden signals on one service, labelled as a stand-in |
| most OWASP Top 10 items | SSRF, XXE, misconfiguration and supply chain need real networks or dependency graphs | out of scope for runnable examples; SQLi, IDOR and access control are kept |

## Open decisions

- **SOLID granularity.** Planned as four concepts because a teaching session targets one idea and each letter has
  its own binding table. A second research pass argued for one `solid` concept with four stages to cut manifest
  maintenance. Revisit after wave 1: if learners treat the letters as one lesson, merge the manifests (the code
  stays the same).

## Deferred

- **Event sourcing** — candidate for a wave 6 after `cqrs-separate-stores` and `domain-events`.
- **Kubernetes / orchestration** — needs a real cluster; health checks and immutable images cover the concepts it relies on.
- **GraphQL vs REST** — a technology comparison rather than a before → after; fold into `api-design-versioning` notes.
- **Rate limiting** — a section in `circuit-breaker-retry-timeout`.
- **CAP and eventual consistency** — trade-off sections in `outbox`, `saga` and `cqrs-separate-stores`.

## Merged or rejected

- **Hexagonal and Clean Architecture as separate concepts** → merged into `ports-and-adapters`. `repository` and
  `dependency-inversion` already teach the mechanics; a third near-identical deck adds vocabulary, not understanding.
- **SOLID as one concept** → four concepts; D is the existing `dependency-inversion`.
- **YAGNI and KISS separately** → one `yagni-kiss`, taught by deleting a speculative abstraction.
- **Blue/green and canary separately** → one simulator concept.
- **Retry, timeout and circuit breaker separately** → one resilience wrapper; they compose around one call.
- **DDD tactical as one concept** → value objects/entities, aggregates and domain events, each with its own smell.
- **Container/presentational alone** → `custom-hooks`, since the transition is the lesson.
- **SSR, SSG and islands separately** → one `rendering-strategies`; splitting repeats the same simulation.
- **Anti-corruption layer in both architecture and refactoring** → taught once, cross-referenced.
- **Encapsulation and separation of concerns as standalone concepts** → they are what SRP, coupling-cohesion and
  layering demonstrate.
- **Full OWASP Top 10** → only items with an honest in-process demo.

† Reference not fetched during research; verify before linking from a published narrative.
