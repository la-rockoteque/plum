---
name: teach
description: Teach a software concept (repository, DI/DIP, CQRS, ORM, unit of work, …) as a lecture-style slide deck bound to the current repo's own domain, language and architecture. Use when the user asks to learn, understand or be taught a design concept, or when a Plum nudge suggests studying one.
argument-hint: "[concept id or question]"
---

Plum ships a concept library: agnostic, runnable before → after examples in Python, C#, TypeScript, Go and Kotlin.
Your job is to turn one concept into a **magistral learning session** — a slide deck — that explains it through
the library's canonical example, then re-binds every role to *this* repository's real types, files and layers.

## 1. Pick the concept

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/plum" concepts --json
```

Match `$ARGUMENTS` against `id`, `title`, `summary` and `signals`. If it's a question ("why is my service so
hard to test?"), choose the concept whose `signals` best fit it. If nothing fits, say which concepts exist and
offer the closest; don't pretend the library covers it. If a `prerequisites` concept is unfamiliar to the user
(check `/plum:skill-health` domains or ask once), include a two-slide primer on it rather than a separate deck.

Read `${CLAUDE_PLUGIN_ROOT}/library/concepts/<id>/CONCEPT.md` in full.

## 2. Survey the consumer repo (bounded — ~10 tool calls)

Find, don't guess:
- **Stack**: manifest files (`package.json`, `*.csproj`, `go.mod`, `pyproject.toml`, `build.gradle*`, …), framework, ORM.
- **Architecture**: top-level layout and layering (controllers/handlers, services/use cases, domain, infra, modules).
- **Domain**: the main nouns — entities/models with state transitions.
- **Role candidates**: for each entry in the manifest's `roles`, the real type/file that plays it — or that it's
  *missing*. Use the `signals` as grep targets (e.g. DB/ORM imports inside services).

Keep 1–3 real excerpts (≤ 25 lines each) that show the concept's problem or its presence. Record exact
`path:line` ranges. Never invent repo code; anything you write in their domain is labelled *illustrative*.

If the repo is empty or unrelated to the concept, bind to the canonical example and say so on the title slide.

## 3. Choose the example language

Use `examples.<lang>` matching the repo's primary language (TypeScript for JS projects, Kotlin for Java). If none
matches, pick the closest in paradigm. Read the stage files and tests from
`${CLAUDE_PLUGIN_ROOT}/library/examples/<lang>/<path>` — quote from them, trimmed to what the slide needs.

## 4. Write the deck

Copy `${CLAUDE_PLUGIN_ROOT}/library/deck/template.html` to `~/.plum/sessions/<concept-id>-<repo-name>.html`
(create the directory). Set `<title>` to the concept name (e.g. "Unit of Work Lecture"). Replace only what's
between the `SLIDES:START` / `SLIDES:END` markers; follow the slide-kind conventions in the template's header
comment. HTML-escape code. In two-column (`.cols`) slides keep code lines under ~60 characters — wrap
arguments or trim — so nothing needs horizontal scrolling. Cite full repo-relative paths in `.src`.

Arc (12–18 slides; drop what doesn't apply, never pad):

1. **title** — concept, one-line thesis, "Bound to: <repo> · <language> · <framework>", duration.
2. **question** — a *predict-first* prompt about their code ("How many files change if…?"). Plum's core habit.
3. **problem** — the pain, shown with a real excerpt from their repo (with `.src` path) — or the canonical before.
4. **idea** — the concept in 3 bullets + the diagram from CONCEPT.md (`<pre class="mermaid">` or text diagram in `.diagram`).
5. **binding** — table: canonical role → role meaning → *their* type/file (`td.missing` when absent).
6. **before** / **after** / **compare** — one slide per manifest stage using the canonical example code.
7. **compare** — the same after-stage rewritten in *their* domain and idioms, tagged `yours`, marked illustrative.
8. **tradeoff** — when not to, costs, what it doesn't solve (from CONCEPT.md).
9. **misconceptions** — as a slide of kind `idea`.
10. **quiz** — the manifest's `checks`, each with a `<details class="answer">`; answers reference their code.
11. **exercise** — one concrete change they could make in *their* repo (file paths), plus how to run the
    canonical example: `cd ${CLAUDE_PLUGIN_ROOT}/library/examples/<lang> && <examples.<lang>.run>`.
12. **recap** — three takeaways; revisit the opening prediction.

Put speaker notes (`<aside class="notes">`) on slides where a presenter would need context.

## 5. Publish

If the Artifact tool is available, publish the file (icon `slides`, a one-sentence description naming the concept
and repo) and share the link. Otherwise give the local path to open in a browser.

## 6. Close the loop

Don't end on the link. Ask one explain-back question from the quiz in chat. If the user answers, grade it
`full` / `partial` / incorrect and call the plum MCP tool `log_explanation` with the concept's domain
(`architecture` for architecture/principles concepts, `implementation` for backend patterns, `testing` for
testing concepts) — as in `/plum:explain`. Don't log an incorrect answer.

Do not modify the user's repository during a teaching session.
