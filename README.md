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

```text
/plugin marketplace add /path/to/Plum        # or <github-owner>/<repo>
/plugin install plum@plum
```

- **User scope** — Plum observes every repo you open.
- **Project scope** — Plum is enabled only for that repo (written to its `.claude/settings.json`, so teammates who trust the marketplace get it too).
- **Local scope** — this repo only, just for you (`.claude/settings.local.json`).

Restart Claude Code after installing. Upgrading from the old `plum install`? Run `bin/plum uninstall` first,
otherwise the legacy hooks in `~/.claude/settings.json` fire alongside the plugin's.

To try it without installing: `claude --plugin-dir /path/to/Plum`.

The plugin wires up:

- **Hooks** (`hooks/hooks.json`) — PreToolUse, PostToolUse, UserPromptSubmit, SessionEnd
- **MCP server** (`.mcp.json`) — `get_skill_context`, `log_explanation`, `log_independence`, `get_weekly_status`
- **Skills** (`skills/`)

| Command | What it does |
|---|---|
| `/plum:skill-health` | Skill radar — 5 domain scores |
| `/plum:cognitive-check` | Weekly delegation breakdown + predict rate |
| `/plum:predict <text>` | Log a hypothesis before asking Claude (core retention gesture) |
| `/plum:verify` | Mark the last delegation as reviewed |
| `/plum:explain` | Explain-back loop, logged via MCP |
| `/plum:teach <concept>` | Lecture deck on a concept, bound to the current repo's domain and architecture |

### Concept library

`library/` holds runnable before → after examples (Python, C#, TypeScript, Go, Kotlin) for repository,
DI vs DIP, CQRS, ORMs and unit of work, each with an agnostic narrative and a manifest of roles that Claude maps
onto the consumer repo. See [library/README.md](library/README.md) and the plan in
[library/ROADMAP.md](library/ROADMAP.md).

Data from every repo lands in the same `~/.plum/atrophy.db`, tagged with the session's `project_path`.

---

## CLI

```bash
bin/plum skill-health         # skill radar
bin/plum status               # weekly summary
bin/plum predict "..."        # log prediction
bin/plum verify               # mark last delegation verified
bin/plum export               # dump DB as JSON
bin/plum reset-scores         # reset all scores to 50
bin/plum wipe --confirm       # delete all local data
bin/plum uninstall            # remove legacy (pre-plugin) hooks from ~/.claude/settings.json
```

Development: `bun test`, `bun run typecheck`, `bun run validate`.

---

## Configuration (`~/.plum/config.json`, optional)

Every key is optional; missing keys fall back to the defaults below.

```jsonc
{
  "enabled": true,
  "mode": "coach",                     // "coach" | "gating"
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
  "domains": { "debugging": true }     // set a domain to false to silence its nudges
}
```

Set `PLUM_DATA_DIR` to move the data directory (and config) elsewhere.

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
