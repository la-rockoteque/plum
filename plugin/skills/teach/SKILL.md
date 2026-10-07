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

Concepts are indexed in English: if the question is in another language, pass English keywords.
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

## 4. Fill the plan and render — two calls

```bash
"$P" teach plan <concept-id> --lang <lang>
```

Prints the slots to fill. The rest of the deck — title, idea and diagram, one slide per stage with the library's
code, trade-offs, misconceptions, quiz questions, the canonical run command — is generated from the concept, so you
don't write it. Write only the slots as one small JSON object to a scratch file, then render:

```bash
"$P" teach render --plan <concept-id> --lang <lang> --fill <fills.json>
```

```json
{
  "meta": "Bound to: shop-api · TypeScript · NestJS + Prisma · ~20 min",
  "question": "If the second save in cancelMany fails, what's left in the database?",
  "problem": { "ref": "repo:src/orders/orders.service.ts", "lines": "40-58" },
  "problemText": "Each save commits on its own, so a failure halfway leaves partial state.",
  "bindings": { "<each role from the plan>": "`TheirType` (src/…)" , "<a role they lack>": "missing" },
  "yours": { "lang": "ts", "text": "await this.prisma.$transaction(async (tx) => { … })" },
  "answers": ["one per quiz question, pointing at their code"],
  "exercise": ["Wrap cancelMany in src/orders/orders.service.ts in one transaction"],
  "recap": ["…", "…", "…"],
  "notes": { "<slide title>": "optional speaker notes" }
}
```

**Language.** Decks follow the `locale` config (`en` by default). If the user writes in French, add `--locale fr`
to both `plan` and `render`: the chrome is French, every slot is written in French, and the plan adds a
`translations` slot — one French string per numbered source string it prints (concept title, summary, roles,
stages, trade-offs, checks), same order. Keep `code` spans and identifiers untranslated. `"missing"` may be
`"manquant"`.

Every slot is required (`problem` may be `null` to reuse the canonical before), `bindings` needs every role the plan
lists, and `answers` one entry per quiz question — the renderer says what's missing. Use a `ref` with a line range
from an outline for any existing code; write `text` only for the illustrative rewrite. The output path is printed
(`~/.plum/sessions/<concept>-<repo>.html`).

For a custom deck instead of the plan, `"$P" teach render --title "<Concept> Lecture" --in <slides.json>` takes a
JSON array of slides (`kind`, `title`, `eyebrow`, `lede`, `meta`, `text[]`, `bullets[]`, `code`, `cols[]`,
`table`, `diagram`, `quiz[]`, `notes`) — only when the plan genuinely doesn't fit.

## 5. Publish

If the Artifact tool is available, publish the rendered file (icon `slides`, a one-sentence description naming the
concept and repo) and share the link. Otherwise give the local path.

## 6. Close the loop

Ask one explain-back question from the quiz in chat. If the user answers, grade it `full` / `partial` / incorrect and
run `"$P" explained <domain> --quality full|partial` with the concept's Plum domain (shown in the brief's first
line) — as in `/plum:explain`. Don't log an incorrect answer.

Then run `"$P" formations match <concept-id>`. If it prints a module, offer it in one line: a hands-on formation
module on this concept exists, and `/plum:formations <formation>` sets it up and starts it. Follow that skill only if
the user says yes. Print nothing if there's no match.

Do not modify the user's repository during a teaching session.
