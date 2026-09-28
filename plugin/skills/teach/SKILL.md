---
name: teach
description: Teach a software concept (repository, DI/DIP, CQRS, aggregates, test doubles, …) as a lecture-style slide deck bound to the current repo's own domain, language and architecture. Use when the user asks to learn, understand or be taught a design concept, or when a Plum nudge suggests studying one.
argument-hint: "[concept id or question]"
---

Turn one concept from Plum's library into a **lecture deck** that explains it through the library's canonical
example and re-binds every role to *this* repository. Use the `plum teach` helpers below — they replace manual
reading, searching and HTML writing. Budget: **five tool calls** before writing the deck, and **never Read whole
files** — use outlines and let the renderer pull code by reference.

```bash
P="${CLAUDE_PLUGIN_ROOT}/bin/plum"
```

## 1. Pick the concept — one call

```bash
"$P" teach match "$ARGUMENTS"
```

Prints up to five `id — title: summary` lines (an exact id ranks first). Choose one. If none fits, say which
concepts exist and offer the closest; don't pretend the library covers it.

## 2. Survey the repo — one call

```bash
"$P" teach survey --concept <concept-id>
"$P" teach outline <file> [<file> …]        # the 1–3 candidates you'll bind to
```

`survey` prints the stack, domain nouns and up to three candidate files for each role category the concept needs —
plus a **From code-map** section with facts from the structural graph when code-map is installed and the repo is
indexed. If `survey` ends with "Strongly recommended: install code-map", pass that recommendation (and the install
commands) to the user once per session, briefly, then continue with the file-name results. If it says the repo isn't
indexed, offer to run `"$P" teach index` (local, nothing written into the repo) and re-run the survey if they agree.
`outline` prints each file's numbered declarations (classes, methods, data-access imports) — enough to bind roles
and choose line ranges for excerpts. Only if an outline can't answer a binding question, Read a narrow line range.
Never invent repo code; anything you write in their domain is labelled *illustrative*.

## 3. Load the concept — one call

```bash
"$P" teach brief <concept-id> --lang <lang>
```

`<lang>` is the repo's closest example language: `typescript` (JS/TS), `python`, `go`, `dotnet` (C#), `kotlin`
(Kotlin/Java). Prints the manifest essentials (roles, signals, stages, checks, run command) and outlines of every
stage and test file in that language — fetched on demand. Use `--full` only if you genuinely need the narrative or
complete code. If the code can't be fetched, the brief says so: teach from the manifest and say so on the title slide.

## 4. Write the deck as JSON — one call

Write a JSON array of slides to a scratch file, then render it:

```bash
"$P" teach render --title "<Concept> Lecture" --in <slides.json>
```

It prints the output path (`~/.plum/sessions/<title>.html`). The renderer escapes everything and produces the
HTML — never write HTML yourself. For any existing code (theirs or the library's), use a `ref` with a line range
from an outline: the renderer reads, slices, escapes and attributes it (`src` is filled in for you). Write `text`
only for the illustrative rewrite in their domain.

Slide fields (all optional except `kind` and `title`; inline text supports `` `code` `` and `**bold**`):

```json
{
  "kind": "title | question | problem | idea | diagram | binding | before | after | compare | tradeoff | quiz | exercise | recap",
  "title": "…", "eyebrow": "…", "lede": "…", "meta": "…",
  "text": ["paragraph", "…"], "bullets": ["…"],
  "code": { "ref": "repo:<path>" | "example:<concept>/<lang>/<file>", "lines": "12-30" },
  "code": { "lang": "ts", "text": "only for code you write yourself (the illustrative rewrite)" },
  "cols": [ { "tag": "before | after | yours", "label": "…", "code": { … }, "bullets": ["…"] } ],
  "table": { "headers": ["Role", "Meaning", "Yours"], "rows": [["…", "…", "…"]], "missing": [[row, col]] },
  "diagram": "plain-text diagram", "mermaid": "graph LR; A-->B",
  "quiz": [ { "q": "…", "a": "…" } ],
  "notes": "speaker notes"
}
```

Arc (12–18 slides; drop what doesn't apply, never pad):

1. **title** — concept, one-line thesis, `meta`: "Bound to: <repo> · <language> · <framework> · ~N min".
2. **question** — a *predict-first* prompt about their code ("How many files change if…?").
3. **problem** — the pain, shown with a real excerpt from their repo (`code.src` = its path) or the canonical before.
4. **idea** — 3 bullets + the diagram from the narrative.
5. **binding** — `table`: canonical role → meaning → *their* type/file; mark absent roles in `missing`.
6. **before** / **after** / **compare** — one per manifest stage, canonical code from the brief (trim to what matters;
   keep lines under ~60 characters in `cols`).
7. **compare** — the after stage rewritten in *their* domain and idioms, `tag: "yours"`, labelled illustrative.
8. **tradeoff** — when not to, costs, what it doesn't solve.
9. **idea** — common misconceptions.
10. **quiz** — the manifest's checks, answers referencing their code.
11. **exercise** — one concrete change in *their* repo (file paths), and the canonical example's run command.
12. **recap** — three takeaways; revisit the opening prediction.

## 5. Publish

If the Artifact tool is available, publish the rendered file (icon `slides`, a one-sentence description naming the
concept and repo) and share the link. Otherwise give the local path.

## 6. Close the loop

Ask one explain-back question from the quiz in chat. If the user answers, grade it `full` / `partial` / incorrect and
call the plum MCP tool `log_explanation` with the concept's Plum domain (shown in the brief's first line) — as in
`/plum:explain`. Don't log an incorrect answer.

Do not modify the user's repository during a teaching session.
