# Plum concept library

Concepts Claude can teach with `/plum:teach <concept>`: an agnostic narrative, a machine-readable manifest, and
runnable **before → after** code in several languages. Claude explains the concept through the canonical example,
re-binds each role to the consumer repo's own types and layers, and produces a lecture deck.

```text
library/
  concepts/<id>/concept.json   manifest: roles, signals, stages, checks, per-language files + run command
  concepts/<id>/CONCEPT.md     the narrative — language- and domain-agnostic
  examples/<lang>/             one runnable, tested project per language, shared by every concept
  deck/template.html           the slide engine Claude fills in
  ROADMAP.md                   planned concepts and release waves
```

`bin/plum concepts` lists what's available (`--json` for the full manifests).

## Current concepts

| Concept | Track | Stages |
|---|---|---|
| `repository` | backend | before → after |
| `dependency-inversion` | principles | before → injection → inversion |
| `cqrs` | architecture | before → after |
| `orm` | backend | raw SQL → ORM |
| `unit-of-work` | backend | save-per-call → one transaction |

Examples exist in Python, C#/.NET, TypeScript, Go and Kotlin. They were imported from the
`formation-backend` mentoring repo (commit `b728329`) and share one tiny domain: **cancel an order**.
That shared domain is deliberate — every concept builds on the one before, so learners compare stages, not
domains. Binding to a real domain is Claude's job at teaching time, driven by each manifest's `roles`.

## Run the examples

| Language | Directory | Tests |
|---|---|---|
| Python 3.12+ | `examples/python` | `python -m venv .venv && .venv/bin/pip install 'pytest>=8' 'SQLAlchemy==2.0.53' 'hypothesis==6.168.3' && .venv/bin/pytest -q` |
| .NET 10 | `examples/dotnet` | `dotnet test RepositoryExample.Tests` |
| TypeScript (Node 22.10+) | `examples/typescript` | `npm ci && npm test` |
| Go 1.25+ | `examples/go` | `go test ./...` |
| Kotlin (JDK 17) | `examples/kotlin` | `./gradlew test` |
| React (Node 22.10+) | `examples/react` | `npm ci && npm test` |
| Infra (Docker, Terraform) | `examples/infra` | `./check-all.sh` |

Each manifest's `examples.<lang>.run` gives the concept's demo command.

## Add a concept

1. **Code first.** Add the stages to the language projects under `examples/<lang>/`. Reuse the existing domain
   when the concept fits it. Each stage must be readable on its own, and every stage gets a test.
2. **Manifest.** Create `concepts/<id>/concept.json` (schema: `Concept` in `src/library.ts`):
   - `roles` — canonical name → agnostic role. This is what makes binding to other repos possible, so describe
     the *role*, not the class.
   - `signals` — what Claude should grep for in a consumer repo that suggests the concept applies.
   - `stages` — ids and one-line ideas. Every language in `examples` must list files for every stage.
   - `checks` — explain-back questions. Each should need understanding to answer, not recall of a name.
3. **Narrative.** Write `concepts/<id>/CONCEPT.md`: problem → idea → roles table ("what to look for in a real
   repo") → stage walk → trade-offs / when not to → misconceptions. Keep it free of language-specific paths.
4. Follow [CONVENTIONS.md](CONVENTIONS.md) — layout, collision rules, allowed libraries, definition of done.
   `bun test src` validates every manifest.
