---
name: feedback
description: Send feedback, a bug report or a feature request about Plum to its author through a pre-filled form the user submits themselves. If the user wants something Plum can't do, offer /plum:feedback to request it.
argument-hint: "[what you'd like to say]"
---

Plum never sends anything by itself: `plum feedback` builds a pre-filled form link, and the user reviews it in the
browser and clicks Submit. Follow these steps exactly.

## When to use

- **Explicit:** the user runs `/plum:feedback <text>` or asks to send feedback, report a bug or request a feature.
- **Unsupported request:** the user asks Plum for something it doesn't do. Say so plainly in one sentence, and
  suggest the closest existing feature (a `/plum:*` skill or `plum` command) if one exists. Then offer once:
  "Want me to send this as a feature request to Plum's author?" Continue only if they say yes.

## 1. Draft

Pick the kind: `feature` (something new), `bug` (something broken) or `feedback` (anything else).
Write a one-line summary, then optional details. Add a short "why" (the use case) when the user gave one.

## 2. Strip sensitive content

The draft must not contain code, file contents, file paths, repository, product or customer names, people's names,
URLs of private systems, tokens or other secrets — unless the user explicitly asks to include them. Describe the
situation generically instead ("a TypeScript monorepo", "a service with a Prisma repository").

## 3. Show it and confirm

Run the command **without** `--open` to produce the exact text:

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/plum" feedback --kind <kind> --message "<summary and details>" [--why "<why>"] [--contact "<only if the user gave one>"]
```

Show the user the printed text verbatim, including the Context line (Plum version, mode, whether statistics are
on, Bun version, OS — nothing identifying). Then ask with AskUserQuestion (prose question if unavailable):

- **Open the form with this text**
- **Open it without the context line** → rerun with `--no-context`
- **Edit the text** → take their edits, go back to step 2
- **Don't send**

## 4. Open

Only after the user chose to open: rerun the same command with `--open`. Tell them it opened in their browser at
the host the command printed, and that **nothing is sent until they click Submit** in the form.

Never submit the form yourself, never fetch or post the link, and never run `--open` without the confirmation in
step 3. If the command reports that feedback is disabled, tell the user their team or personal config turned it off.

## Usage statistics

If the user wants to share Plum's opt-in usage statistics, run `"${CLAUDE_PLUGIN_ROOT}/bin/plum" stats send`,
show the printed `[Usage statistics]` summary, and apply the same confirm-then-`--open` rule. If statistics are off,
say so and point to `docs/usage-statistics.md` rather than turning them on for the user.
