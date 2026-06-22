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

Set `"mode": "gating"` in `plum.config.json` to block high-severity patterns instead of just coaching.

---

## Setup

```bash
# 1. Install dependencies (Bun only — uses bun:sqlite, no npm install needed)
bun --version   # needs 1.x

# 2. Wire hooks into ~/.claude/settings.json
bun run src/cli.ts install

# 3. Restart Claude Code — hooks activate immediately
```

Hooks point to `hooks/` in this repo. Runtime data lives in `~/.plum/` (gitignored).

---

## Slash Commands (install to ~/.claude/skills/)

```bash
cp skills/*.md ~/.claude/skills/
```

| Command | What it does |
|---|---|
| `/skill-health` | Print skill radar — 5 domain scores with trend arrows |
| `/cognitive-check` | Weekly delegation breakdown + predict rate |
| `/predict <text>` | Log a hypothesis before asking Claude (core retention gesture) |

---

## CLI

```bash
bun run src/cli.ts skill-health    # skill radar
bun run src/cli.ts status          # weekly summary
bun run src/cli.ts predict "..."   # log prediction
bun run src/cli.ts export          # dump DB as JSON
bun run src/cli.ts reset-scores    # reset all scores to 50
bun run src/cli.ts uninstall       # remove hooks from ~/.claude/settings.json
```

---

## Configuration (`plum.config.json`)

```json
{
  "enabled": true,
  "mode": "coach",                     // "coach" | "gating"
  "minEventsBeforeIntervene": 8,       // calibration gate
  "thresholds": {
    "testDelegationMin": 3,
    "debugDelegationRate": 0.75,
    "blindAcceptanceMin": 4,
    "archOutsourcingMin": 3,
    "archOutsourcingRate": 0.70
  }
}
```

---

## Ethics

- **Local-first**: all data in `~/.plum/atrophy.db`, never sent anywhere
- **Opt-in**: set `"enabled": false` to disable entirely
- **User-owned**: `plum export` gives full JSON dump; delete `~/.plum/` to wipe everything
- **Coach, not judge**: interventions are coaching nudges, not blocking errors

---

## Phase Roadmap

| Phase | Status | Description |
|---|---|---|
| 1 — Observer | ✅ Done | Hook-based event logging (PreToolUse, PostToolUse, UserPromptSubmit, SessionEnd) |
| 2 — Pattern Detection | ✅ Done | 5 risk patterns with severity levels |
| 3 — Skill Model | ✅ Done | 5-domain scoring with delta updates |
| 4 — Intervention Engine | ✅ Done | 5 coaching intervention types, injected via hook stdout |
| 5 — Skills + CLI | ✅ Done | `/skill-health`, `/cognitive-check`, `/predict` + full CLI |
| 6 — Claude.ai Cowork | 🔜 Planned | Browser surface for synthesis/decision outsourcing |

---

## Research Questions (from the original spec)

- **RQ1**: Does AI reduce solution ownership?
- **RQ2**: Which interventions improve retention?
- **RQ3**: Which behaviors predict expertise?
- **RQ4**: Which skills degrade first?
- **RQ5**: Can interventions reverse atrophy?

The `export` command gives you the raw data to run these analyses.
