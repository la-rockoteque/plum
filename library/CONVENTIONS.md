# Concept conventions

Every concept in the library follows these rules so that many concepts can be added in parallel without touching
each other's files, and so `/plum:teach` can rely on the same shape everywhere.

## Files per concept

```text
library/concepts/<id>/concept.json    manifest (schema: Concept in src/library.ts)
library/concepts/<id>/CONCEPT.md      narrative
library/examples/<lang>/...           code + tests, laid out as below
```

A concept **only adds files, and only inside its own paths** (the table below). It never edits an existing file —
not the shared domain, not another concept, not a build or lock file — and never creates shared files such as
`conftest.py`, `tests/helpers.*` or a new top-level test utility. Parallel work then merges without conflicts.
Every dependency a concept may use is already installed (see "Allowed libraries"); if one is missing, stop and
report it instead of adding it.

A concept defines whatever small domain types it needs inside its own package, even when a similar `Order` exists
elsewhere. Stages are teaching snapshots; duplication between them is intended.

**Reusing another concept's code.** When a stage *is* another concept's existing code (seams' `before` is the
dependency-inversion `before`; replace-conditional's `before` is open-closed's `before`), point the manifest's
stage file list at those existing files instead of copying them — as `unit-of-work` does with `orm`. Write new
files only for stages that differ.

## Code layout per language

`<id>` is the kebab-case concept id. `<snake>` = `single_responsibility`, `<flat>` = `singleresponsibility`,
`<Pascal>` = `SingleResponsibility`. `<stage>` is the stage id from the manifest (`before`, `after`, …).

| Language | Stage code | Tests | `run` (from `library/examples/<lang>`) |
|---|---|---|---|
| python | `src/<snake>/<stage>.py` (or `src/<snake>/<stage>/` for several modules) | `tests/test_<snake>.py` | `.venv/bin/pytest -q tests/test_<snake>.py` |
| typescript | `src/<id>/<stage>.ts` (or `src/<id>/<stage>/`) | `tests/<id>.test.ts` (`node:test`, `node:assert/strict`, `.js` import suffixes) | `npm run build && node --experimental-sqlite --test dist/tests/<id>.test.js` |
| go | `<flat>/<stage>/*.go` (package name = stage) | `<flat>/<stage>/*_test.go` | `go test ./<flat>/...` |
| dotnet | `RepositoryExample/<Pascal>/<Stage>/*.cs`, namespace `RepositoryExample.<Pascal>.<Stage>` | `RepositoryExample.Tests/<Pascal>Tests.cs` (xUnit) | `dotnet test RepositoryExample.Tests --filter FullyQualifiedName~RepositoryExample.Tests.<Pascal>Tests.` |
| kotlin | `src/main/kotlin/example/<flat>/<stage>/*.kt`, package `example.<flat>.<stage>` | `src/test/kotlin/example/<Pascal>Test.kt` (kotlin.test) | `./gradlew test --tests 'example.<Pascal>Test'` |
| react | `src/<id>/<stage>/*.tsx` | `tests/<id>.test.tsx` (Vitest + Testing Library) | `npx tsc --noEmit && npx vitest run tests/<id>.test.tsx` |
| infra | `<id>/<stage>/…` (Dockerfile, YAML, `.tf`, scripts) | `<id>/check.sh` (exits non-zero on failure) | `./<id>/check.sh` |

Backend, principles, testing, architecture, refactoring, security and **code-level infra** concepts ship in **all
five** backend languages — that includes twelve-factor-config, secrets-management, health-checks, feature-flags,
observability, circuit-breaker-retry-timeout, caching-strategies and blue-green-canary-deploy (an in-memory router
simulator). Frontend concepts ship in `react`. Only deployment-medium concepts (containerization, ci-pipeline,
infrastructure-as-code, immutable-infrastructure) ship in `infra`. The validator enforces this.

### Language rules that prevent collisions

- **Stage ids** match `^[a-z]+$` and are not keywords in any language (`default`, `in`, `is`, `object`, …); they
  become Go packages, Python modules, Kotlin packages and C# namespaces.
- **C#:** tests reference stage types only through aliases —
  `using OutboxBefore = RepositoryExample.Outbox.Before;` then `OutboxBefore.Outbox`. Never write bare `Before.X`
  (it resolves to the existing `RepositoryExample.Before` namespace), and never name a type `<Pascal>` (a class
  `Outbox` inside `RepositoryExample.Outbox.*` is shadowed by the namespace). Add `using Xunit;` explicitly.
- **C# and Kotlin:** test helper types (fakes, clocks, builders) are **nested inside the test class**, never at
  namespace/package level, so two concepts' `FakeClock`s can't collide.
- **Python, Go, TypeScript:** helpers live in the concept's own test file or its own package, never in shared modules.
- **Kotlin + kotest-property:** `checkAll` is `suspend`; wrap it in a block body —
  `@Test fun ...() { runBlocking { checkAll(...) { ... } } }`. An expression body (`= runBlocking { }`) returns a
  value and JUnit 4 rejects the class.
- **dotnet + FsCheck:** use `[Property]` from `FsCheck.Xunit` alongside `[Fact]`.

### Test names

One lesson sentence, rendered per language. For "before: cancelling a shipped order silently succeeds":

| Language | Name |
|---|---|
| python | `test_before_cancelling_a_shipped_order_silently_succeeds` |
| go | `TestBefore_CancellingAShippedOrderSilentlySucceeds` |
| dotnet | `Before_CancellingAShippedOrderSilentlySucceeds` |
| kotlin | `` `before - cancelling a shipped order silently succeeds` `` (no `:` — illegal in JVM names) |
| typescript / react | `"before: cancelling a shipped order silently succeeds"` |

### Allowed libraries

Everything below is already installed. Nothing else.

| Project | Allowed beyond the standard library |
|---|---|
| python | pytest, SQLAlchemy, hypothesis, `unittest.mock` |
| typescript | node:test, node:assert, node:sqlite / better-sqlite3, drizzle-orm, fast-check |
| go | testing (incl. `testing/quick`), database/sql + the existing sqlite driver, gorm |
| dotnet | xUnit, Microsoft.Data.Sqlite, EF Core, FsCheck.Xunit |
| kotlin | kotlin.test, the existing sqlite/Exposed deps, kotest-property |
| react | react, react-dom, Testing Library (+ user-event, jest-dom), vitest, @tanstack/react-query |
| infra | Docker and Terraform CLIs (see infra rules) |

Consequences agents must follow: **no mocking frameworks** (Moq, NSubstitute, MockK, Mockito, sinon) — hand-roll
doubles; **no validation libraries** (zod, pydantic, FluentValidation); **no resilience libraries** (Polly,
resilience4j, tenacity) and no coroutines; **no logging frameworks** — use a small logger port; **no web servers
or frameworks** — an HTTP handler is a plain function from a request record to a response record; **time is an
injected clock**, never the wall clock.

### Infra rules

- Terraform uses only the built-in `terraform_data` resource and `locals`/`variables`/`outputs` — no providers to
  download. `check.sh` runs `terraform init -backend=false`, `validate` and `plan`; never `apply`.
- `docker build`/`run` pull images, so they are **opt-in**: `check.sh` always runs static assertions (grep the
  Dockerfile/pipeline for the property being taught) and runs Docker only when `PLUM_INFRA_DOCKER=1`, printing
  `SKIP docker` otherwise and still exiting 0.
- CI YAML is checked statically (structure and the lesson's key lines via grep/`python3 -c`); both GitLab CI and
  GitHub Actions files may be shown.
- `chmod +x` every `check.sh` and commit it executable.

No new demo entry points: the targeted test command *is* the demo. Tests are named so their output reads as the
lesson ("before: cancelling a shipped order silently succeeds").

## Shared idioms

Concepts build on each other, so they speak the same small domain. Use these unless the idiom itself is the lesson
(value-objects-entities *introduces* them; a `before` stage may deliberately use a worse shape):

| Idiom | Shape |
|---|---|
| Order status | `OrderStatus { pending, shipped, cancelled }`; the canonical rule is "a shipped or cancelled order can't be cancelled" |
| Money | integer minor units named `amountMinor` (plus `currency` only when currency is part of the lesson) — never floats |
| Time | a `Clock` port with `nowMs()`; tests use `FixedClock` |
| Ids | integers |
| Repository port | `get(id)` → detached copy or "not found"; `save(entity)` inserts or updates and stores a copy |
| Test doubles | named by role per the test-doubles concept: dummy, stub, spy, mock, fake. In-memory fakes copy on write *and* read |

## Stages and tests

- 2 stages by default (`before`, `after`); a 3rd only when the middle step is itself the lesson.
- Each stage is readable on its own, fits on one or two slides (aim ≤ 80 lines of non-test code per stage per
  language), and is idiomatic for its language (Go returns errors, C#/Kotlin use explicit interfaces, Python uses
  `Protocol`/dataclasses, TypeScript uses structural types).
- **Every stage has tests, and every test passes.** When the `before` has a flaw the concept fixes (a partial
  write, a stale response, a leaked row), a *passing* test demonstrates the flaw by asserting the flawed outcome and
  says so in its name. No skip/xfail/ignore markers anywhere — including the "red" stage of red-green-refactor,
  whose test asserts that the rule is missing. `after` tests prove the fix. Where the flaw is structural (coupling,
  change cost), tests show the consequence: a change that forces an edit in N places, a fake stuffed with unused
  methods. A "real dependency" in a before stage is simulated by a stand-in that throws "network unavailable".
- **Tests prove the lesson.** For every claim the `after` stage makes, there is a production line whose deletion makes
  a test fail. A test that passes with the fix removed proves nothing — check before committing.
- **Structural flaws are shown as change cost** — N callers to edit, N places that drift, a fake that must stub
  unused methods — never as a null dereference, panic or crash that a local check would also fix.
- **"Behaviour stays the same" lessons** (red-green-refactor, yagni-kiss, refactorings) run *one* shared test body
  against every stage: pytest `parametrize`, a Go table over constructors, xUnit `[Theory]`, a Kotlin loop over
  factories, a TypeScript loop over implementations. Keep the stages' public shape identical so that's possible.
- Same behaviour, same test cases, same names (idiomatically cased) across languages.
- No network, no external services. In-memory fakes or SQLite (already a dependency in every project).
- Deterministic: no sleeps, no wall-clock timing, no random seeds without fixing them.

## Manifest (`concept.json`)

| Field | Rule |
|---|---|
| `id` | kebab-case, equals the directory name |
| `category` | `principles` · `testing` · `architecture` · `backend` · `frontend` · `infra` · `refactoring` · `security` |
| `domain` | the Plum skill domain it strengthens: `implementation` · `debugging` · `testing` · `architecture` · `synthesis` |
| `level` | `foundation` · `intermediate` · `advanced` |
| `summary` | one sentence, > 20 characters, no trailing jargon |
| `prerequisites`, `related` | ids that **already exist** in the library |
| `signals` | 3–4 things Claude can grep for or notice in a real repo |
| `roles` | canonical name → agnostic role ("aggregate that owns the invariant", not "the Order class") |
| `stages` | `{id, title, idea}` in teaching order |
| `checks` | 3–4 explain-back questions that need understanding, not recall of a term |
| `examples.<lang>` | `stages` (every stage id → files), `tests`, `run` — paths relative to `library/examples/<lang>/` |

`bun test src` validates the manifest: required fields and counts, id format, stage-id format, known language
keys, all five backend languages where required, non-empty `tests` and `run`, existing prerequisite/related ids
and every referenced file. `related` may only name concepts that already exist; the orchestrator backfills
forward links at the end of the roadmap.

## Narrative (`CONCEPT.md`)

Language- and domain-agnostic. Sections, in order:

1. `# Title` and a one-line blockquote thesis
2. **The problem** — the pain, in general terms
3. **The idea** — what changes, with a small text diagram when structure matters
4. **Roles — find them in any codebase** — table: role · canonical example · what to look for in a real repo
5. **Walk the stages** — one step per stage, pointing at what to notice
6. **Trade-offs / when not to** — the cost, and when the simpler thing is right
7. **Common misconceptions**
8. Optional: **Language notes**, **Exercise**

No language-specific file paths in the narrative; the manifest carries those. Cite primary references
(Fowler, Beck, Feathers, Evans/Vernon, OWASP, react.dev, 12factor.net, SRE book) in a final **References** list.

## Bootstrap in a fresh worktree

Worktrees contain only committed files, so set up each project before running tests:

```sh
cd library/examples/python     && uv venv -q -p 3.12 .venv && uv pip install -q -p .venv/bin/python 'pytest>=8' 'SQLAlchemy==2.0.53' 'hypothesis==6.168.3'
cd library/examples/typescript && npm ci --silent
cd library/examples/react      && npm ci --silent
# go, dotnet and kotlin restore on first build
```

## Definition of done for a concept

1. The concept's `run` command passes in every language it ships in. For dotnet, the output's `Total:` count must
   equal the number of tests you wrote (`dotnet test` exits 0 when a filter matches nothing).
2. Compile-only checks for the shared projects pass: `npm run build` (typescript), `dotnet build`
   (dotnet), `./gradlew compileTestKotlin` (kotlin), `go vet ./...` (go), `npx tsc --noEmit` (react).
3. `bun test src` passes from the repo root.
4. `git status` shows only files inside the concept's own paths.

## Commits

One commit per concept: `feat(library): add <id> concept`, body listing languages and test counts, ending with the
Co-Authored-By trailer used in this repo.
