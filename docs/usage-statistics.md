# Usage statistics

Plum can keep **opt-in, local, counts-only** statistics about its own runs, so you can see how it behaves and,
if you choose, share an aggregated summary with its author. They are **off by default**.

## Turn them on

Only you can turn them on, in your personal config or this machine's project-local config:

```json
// ~/.plum/config.json  or  <project>/.plum/config.local.json (keep it out of git)
{ "telemetry": { "enabled": true } }
```

A committed, shared `<project>/.plum/config.json` **cannot** turn them on — and neither can a
`config.local.json` that has been committed to git (it's treated as shared). It can turn them off for everyone:
`{ "telemetry": { "enabled": false } }` wins over any personal setting.

`bin/plum stats status` shows whether they're on and where the data lives.

## What is recorded

One line per Plum run (hook, CLI command or MCP tool call) in `~/.plum/usage.jsonl`:

- the command name (from a fixed list), and the run's duration
- counts: prompt and tool categories, patterns detected, which nudge type fired, verifications
- file extensions of edited files (`.ts`, `.py`)
- error type names (`TypeError`)
- your verdicts on nudges, if recorded (`confirmed` / `false_positive` per pattern)

## What is never recorded

Prompt or file text, code, tool inputs or outputs, matches, file names, paths, repository or project names, user
names. Every field is checked against a strict shape before it is written; anything that doesn't fit is dropped.

## Retention

Events older than `telemetry.retentionDays` (default 30) are dropped, and above about 1 MB the oldest half is
dropped.

## Debug mode

`{ "telemetry": { "enabled": true, "debug": true } }` also writes full tracebacks of Plum errors to
`~/.plum/usage-debug.log`. Tracebacks contain local paths — **don't share that file**. It is never part of a summary.

## Look at them

```sh
bin/plum stats summary              # last 30 days, human-readable
bin/plum stats summary --days 7 --json
```

## Record a verdict on a nudge

```sh
bin/plum stats verdicts '{"pattern":"test_delegation","verdict":"false_positive"}'
```

## Share them

```sh
bin/plum stats send          # prints the [Usage statistics] summary and a pre-filled form link
bin/plum stats send --open   # also opens the form; you still click Submit yourself
```

The summary holds totals, medians, top categories and ratios — never raw events. Nothing leaves your machine
unless you submit the form. In Claude Code, `/plum:feedback` asks before opening it.

## Clear them

```sh
bin/plum stats clear         # deletes usage.jsonl and the debug log
```
