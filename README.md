<p align="center"><img src="assets/plum.png" alt="Professor Plum" width="160"></p>

# Professor Plum

> A metacognitive harness around Claude Code (and eventually Codex) that detects cognitive outsourcing, identifies skill atrophy risks, and introduces coaching interventions to preserve expertise while still benefiting from AI assistance.

---

## Core Idea

The system acts as a coach, not a gatekeeper.  
**AI should accelerate work, not replace learning.**

```
User prompts → Claude Code tools
                    ↓
          [Plum hooks observe]
                    ↓
          Pattern Detection  →  Skill Model (5 domains, scored 0–100)
                    ↓
          Intervention Engine  →  Claude sees coaching message
                    ↓
          Claude asks the user to predict / explain / recall first
```

---

## Behavioral Model

**Antecedent → Behavior → Consequence**

- **Antecedent**: what triggered the request
- **Behavior**: what the user delegated
- **Consequence**: whether the user verified, understood, or just accepted

---

## 5 Skill Domains

| Domain | Atrophy Risk |
|---|---|
| Implementation | Blind acceptance of generated code |
| Debugging | Never attempting root cause before asking |
| Testing | Always letting Claude write tests |
| Architecture | Outsourcing all design decisions |
| Synthesis | Accepting explanations without engagement |

### How the score works

Each domain's score is how much **you** engaged with your own requests in that domain over the last 30 days — not
how many tool calls Claude made. Every prompt you send is a request, and it counts as engaged by what you do around it:

| You… | Weight |
|---|---|
| solved it yourself (`plum independent`, or detected: 3+ lines you changed between Claude's turns, in files Claude didn't touch) | 3 (a fully engaged request of its own) |
| explained the result back, fully | 2 |
| predicted before asking (`/plum:predict`) | 1 |
| explained it back partially, or ran `plum verify` | 1 |

A request's value is its weight capped at 3, divided by 3. The score is `100 × (Σ values + 2) / (requests + 4)`: 50
with no data, and a handful of events can't push it to 0 or 100. Claude's own test runs and file reads are neutral.
The trend compares the last 7 days with the 7 before; a domain is flagged at risk below 35 with at least 10 requests.
Scores are computed from your events each time, so there's no running total to drift. The old running score is still
recorded for research exports (`skill_scores` in `plum export`).

---

## Interventions (non-blocking by default)

| Pattern | Intervention |
|---|---|
| `test_delegation` | `test_first` — ask user to write spec before Claude writes tests |
| `debugging_avoidance` | `predict_first` — require hypothesis before debugging |
| `blind_acceptance` | `explain_back` — require explanation before moving on |
| `architectural_outsourcing` | `predict_first` — require sketch before Claude designs |
| `repeated_weakness` | `retrieval_exercise` — ask user to recall before re-explaining |
| `decision_outsourcing` | `predict_first` — user asks Claude to decide without offering a view |
| `design_critique_atrophy` | `diff_review` — design changes accepted without review |

Nudges are injected into Claude's context via the PreToolUse hook and fire at most once per pattern every
`interventionCooldownMs` (30 min by default) — per session for session patterns, across sessions for week-wide ones. Set `"mode": "gating"` to make high-severity
patterns also ask for permission before the tool runs.

---

## Install (any repo)

Plum ships as a Claude Code plugin; this repo is its own marketplace. Requires [Bun](https://bun.sh) 1.x.

```sh
claude plugin marketplace add https://github.com/la-rockoteque/plum.git --sparse .claude-plugin plugin
claude plugin install plum@plum            # add --scope project to enable it for one repo only
```

(or `/plugin marketplace add …` and `/plugin install plum@plum` inside Claude Code). `--sparse` keeps the marketplace
clone to the plugin itself; the installed plugin (`plugin/`) carries the runtime, skills and concept manifests, and
example code is streamed per concept when a lecture needs it — see [docs/library-cache.md](docs/library-cache.md).

- **User scope** — Plum observes every repo you open.
- **Project scope** — Plum is enabled only for that repo (written to its `.claude/settings.json`, so teammates who trust the marketplace get it too).
- **Local scope** — this repo only, just for you (`.claude/settings.local.json`).

Restart Claude Code after installing. Upgrading from the old `plum install`? Run `plugin/bin/plum uninstall` first,
otherwise the legacy hooks in `~/.claude/settings.json` fire alongside the plugin's.

To try it without installing: `claude --plugin-dir /path/to/Plum`.

**Updates:** every push to `main` is a new version. On session start Plum checks for one and asks whether to
update (or updates silently if you opt in) — see [docs/updates.md](docs/updates.md).

The plugin wires up:

- **Hooks** (`hooks/hooks.json`) — PreToolUse, PostToolUse, UserPromptSubmit, Stop, SessionEnd
- **Skills** (`skills/`)

| Command | What it does |
|---|---|
| `/plum:skill-health` | Skill radar — 5 domain scores |
| `/plum:cognitive-check` | Weekly delegation breakdown + predict rate |
| `/plum:predict <text>` | Log a hypothesis before asking Claude (core retention gesture) |
| `/plum:verify` | Mark the last delegation as reviewed |
| `/plum:explain` | Explain-back loop, logged with `plum explained` |
| `/plum:teach <concept>` | Lecture deck on a concept, bound to the current repo's domain and architecture |
| `/plum:formations [concept]` | Find a hands-on formation, fetch it to `~/formations/<id>`, and start it in this session |
| `/plum:goals` | Propose growth goals from your Plum data; optionally create them in a connected tool (Leapsome) |
| `/plum:connect <connector>` | Create goals or sync progress through a connector, always showing the exact payload first |
| `/plum:feedback <text>` | Draft feedback or a feature request, review it, then open a pre-filled form you submit yourself |

**Strongly recommended:** install [code-map](docs/code-map.md) so `/plum:teach` binds concepts to your code from a
structural graph (implementations, ORM users, callers) instead of file-name guesses — and spends fewer tokens doing it.

### Concept library

`library/` holds runnable before → after examples (Python, C#, TypeScript, Go, Kotlin) for repository,
DI vs DIP, CQRS, ORMs and unit of work, each with an agnostic narrative and a manifest of roles that Claude maps
onto the consumer repo. See [library/README.md](library/README.md) and the plan in
[library/ROADMAP.md](library/ROADMAP.md).

Data from every repo lands in the same `~/.plum/atrophy.db`, tagged with the session's `project_path`.

---

## CLI

```bash
plugin/bin/plum skill-health         # skill radar
plugin/bin/plum status               # weekly summary
plugin/bin/plum predict "..."        # log prediction
plugin/bin/plum verify               # mark last delegation verified
plugin/bin/plum export               # dump DB as JSON
plugin/bin/plum reset-scores         # reset all scores to 50
plugin/bin/plum wipe --confirm       # delete all local data
plugin/bin/plum feedback --kind feature --message "…"   # print a pre-filled feedback link (--open to open it)
plugin/bin/plum stats status         # opt-in usage statistics: status | summary | verdicts | send | clear
plugin/bin/plum update [--apply]     # check for a newer Plum now (and install it)
plugin/bin/plum library status       # streamed example cache: fetch <concept> [--lang L] | status | gc | keep | clear
plugin/bin/plum formations           # hands-on formations: list | match <concept> | fetch <formation> [--lang L] [--dir D]
plugin/bin/plum teach match "…"      # lecture helpers: match | survey | brief <concept> --lang L | render --in slides.json
plugin/bin/plum uninstall            # remove legacy (pre-plugin) hooks from ~/.claude/settings.json
```

Development: `bun test`, `bun run typecheck`, `bun run validate`.

---

## Configuration (optional)

Three optional JSON files, merged in this order (later wins):

| File | Scope |
|---|---|
| `<project>/.plum/config.json` | shared — committed, applies to everyone on the repo |
| `~/.plum/config.json` | personal |
| `<project>/.plum/config.local.json` | this machine only for this repo — keep it out of git |

Every key is optional; missing keys fall back to the defaults below. **Trust rules:** only the personal or local
file can turn on `telemetry.enabled`/`telemetry.debug` or choose `updates.mode: "silent"`, and only they can set
`library.repoUrl`/`library.ref`; a shared `false`/`"off"` always wins. A `config.local.json` that is committed to git
is treated as shared.

```jsonc
{
  "enabled": true,
  "mode": "coach",                     // "coach" | "gating"
  "locale": "en",                      // "en" | "fr" — language of /plum:teach decks (any layer; a team can commit "fr")
  "minEventsBeforeIntervene": 8,       // calibration gate
  "interventionCooldownMs": 1800000,   // min gap between repeats of the same nudge
  "thresholds": {
    "testDelegationMin": 3,
    "debugDelegationRate": 0.75,
    "blindAcceptanceMin": 4,
    "archOutsourcingMin": 3,
    "archOutsourcingRate": 0.70,
    "weekLookbackMs": 604800000
  },
  "domains": { "debugging": true },    // set a domain to false to silence its nudges
  "feedback": {
    "enabled": true,
    "formUrl": "https://docs.google.com/forms/d/e/1FAIpQLScqThybRTWZfcqaKSlTGzE2uPhKo5rhg47YYKbJGmxir_VLlg/viewform",
    "entryId": "entry.1018508464"      // the form's paragraph field
  },
  "teach": {
    "codeMap": "auto"                  // "auto" | "required" | "off" — see docs/code-map.md
  },
  "library": {                         // example code streamed on demand (docs/library-cache.md)
    "cacheMaxMb": 25,
    "cacheTtlDays": 30,
    "keepAfterUses": 3                 // concepts fetched this often stay cached
  },
  "updates": {
    "mode": "prompt",                  // "prompt" | "silent" (personal/local only) | "off"
    "checkIntervalHours": 12
  },
  "telemetry": {
    "enabled": false,                  // opt-in; personal/local config only
    "debug": false,                    // also log tracebacks locally (contain paths; don't share)
    "retentionDays": 30
  }
}
```

Set `PLUM_DATA_DIR` to move the data directory (and config) elsewhere.

---

## Feedback

Send feedback, bugs and feature requests with `/plum:feedback`, or directly through the
[feedback form](https://forms.gle/TCAnGgHfUjDg6KkWA). Claude shows you the exact text first, and nothing is sent
until you click Submit. See [docs/feedback.md](docs/feedback.md).

**Connectors** (e.g. Leapsome) are off by default, enabled only from your personal config, and send only goal titles,
reasons, due dates and progress percentages — through your own connected MCP, after you confirm. See
[docs/connectors/README.md](docs/connectors/README.md).

**Usage statistics** are off by default, opt-in from your personal config only, stored locally as counts (never
text, paths or names), and shared only if you submit a summary yourself —
[docs/usage-statistics.md](docs/usage-statistics.md).

---

## Ethics

- **Local-first**: all data in `~/.plum/atrophy.db`, never sent anywhere
- **Opt-in**: set `"enabled": false` to disable entirely
- **User-owned**: `plum export` gives full JSON dump; `plum wipe --confirm` deletes everything
- **Coach, not judge**: interventions are coaching nudges, not blocking errors

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| 1 — Observer | ✅ Done | Hook-based event logging (PreToolUse, PostToolUse, UserPromptSubmit, SessionEnd) |
| 2 — Pattern Detection | ✅ Done | 7 risk patterns with severity levels |
| 3 — Skill Model | ✅ Done | 5-domain scoring with delta updates |
| 4 — Intervention Engine | ✅ Done | 5 coaching intervention types, injected via hook stdout |
| 5 — Skills + CLI | ✅ Done | `/skill-health`, `/cognitive-check`, `/predict`, `/verify`, `/explain` + full CLI |
| 5.5 — Plugin | ✅ Done | Installable per-user or per-repo as a Claude Code plugin |
| 6 — Claude.ai Cowork | 🔜 Planned | Browser surface for synthesis/decision outsourcing |

---

## Research Questions (from the original spec)

- **RQ1**: Does AI reduce solution ownership?
- **RQ2**: Which interventions improve retention?
- **RQ3**: Which behaviors predict expertise?
- **RQ4**: Which skills degrade first?
- **RQ5**: Can interventions reverse atrophy?

The `export` command gives you the raw data to run these analyses.
