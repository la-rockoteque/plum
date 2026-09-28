# Connectors — design (draft)

Status: brainstorm on `research/connectors-leapsome`. Nothing here is implemented yet.

**Goal:** let a user take what Plum measures — skill scores, trends, engagement habits, concepts studied — into the
tools where they track their growth (first: Leapsome goals), without Plum becoming an integration platform or
holding anyone's credentials.

## Principles

1. **Modular and isolated.** A connector is a folder with a manifest and instructions. The core never imports a
   connector; hooks never touch one (they stay fast and offline). Removing a connector's folder removes it completely.
2. **Claude-mediated first.** Most target tools already have an MCP server the user connects to Claude directly
   (Leapsome, Linear, Jira, Notion, Slack, Google Calendar…). Plum prepares the data; Claude calls the user's own
   connected MCP tools. Plum stores no tokens and makes no network calls. API connectors (Plum calling a service
   itself) are a later, separate kind — only if a tool has no MCP.
3. **Consent like usage statistics.** Connectors are off until enabled from the personal or local config; a
   committed team config can only disable them. Before anything leaves, the user sees the exact payload (same
   show-then-confirm rule as `/plum:feedback`), and the target tool's own confirmation still applies.
4. **Counts and goals, never content.** Payloads carry scores, rates, trends and concept ids — no prompts, code,
   file paths or repo names — enforced by a typed, shape-checked payload, like the usage-statistics recorder.
5. **One core contract, many connectors.** Core produces connector-agnostic objects; a connector only maps them.

## Core contract (connector-agnostic)

```ts
// What Plum knows about progress over a period.
interface ProgressSnapshot {
  period: { from: string; to: string };                 // ISO dates
  domains: Record<Domain, { score: number; trend: "up" | "down" | "stable"; delegationRate: number }>;
  habits: { verifyRate: number; predictRate: number; explanations: number; independence: number };
  concepts: { id: string; lectures: number; lastExplainBack?: "full" | "partial" }[];
}

// A goal Plum suggests, measurable by Plum itself so progress can be synced later.
interface GoalProposal {
  id: string;                          // stable, e.g. "raise-testing-2026Q4"
  title: string;                       // "Get my testing skill from 34 to 60"
  why: string;                         // one sentence from the data
  metric: { kind: "domain-score" | "habit-rate" | "concepts-completed"; key: string; from: number; target: number };
  due: string;                         // ISO date
  suggestedPractice: string[];         // e.g. "/plum:teach test-doubles", "predict before asking in debugging"
}

// A connector's record that a proposal became something in the target tool.
interface Link { proposalId: string; connector: string; externalId: string; createdAt: string; lastSynced?: string }
```

New core commands (no connector knowledge):

- `plum progress [--days N] [--json]` — the `ProgressSnapshot`.
- `plum goals propose [--max 3]` — up to three `GoalProposal`s from the weakest domains and habits.
- `plum goals progress` — current value of every linked goal's metric (what a sync would write).
- `plum connectors list | status | enable <id> | disable <id> | link <id> <proposalId> <externalId>` — registry,
  consent and links (stored in `~/.plum/connectors/<id>/links.json`).

## A connector

```text
plugin/connectors/leapsome/
  connector.json     manifest
  instructions.md    how Claude maps core objects onto the target's MCP tools
```

```json
{
  "id": "leapsome",
  "name": "Leapsome",
  "kind": "mcp-mediated",
  "capabilities": ["goals.create", "goals.progress", "goals.comment"],
  "mcp": { "discover": "mcp__.*leapsome.*", "requires": "The Leapsome MCP connected in Claude (an admin must enable MCP for your workspace)" },
  "sends": ["GoalProposal.title", "GoalProposal.why", "GoalProposal.due", "current metric value"],
  "visibility": "Goals and progress follow your Leapsome goal visibility — likely visible to your manager."
}
```

One generic skill, `/plum:connect`, reads the manifest and instructions of an enabled connector and runs the flow;
adding a connector adds no new skill and no core code.

## Flows

**Set goals** (`/plum:goals`)
1. `plum goals propose` → Claude shows 1–3 proposals; the user picks, edits or declines (AskUserQuestion).
2. For each enabled connector with `goals.create`: Claude shows the exact payload and who will see it
   (`visibility`), then calls the target's MCP tool; the target's own confirmation step applies.
3. `plum connectors link leapsome <proposalId> <goalId>` records the mapping.

**Sync progress** (suggested weekly, never automatic)
1. `plum goals progress` → current value per linked goal.
2. Claude shows the updates ("Testing 34 → 48 of 60"), and on confirmation calls the target's update-progress tool,
   optionally with a short comment ("Plum weekly: 3 lectures, explain-backs on test doubles").

## Future connectors (same contract)

| Connector | Kind | What it would do |
|---|---|---|
| Linear / Jira | mcp-mediated | turn a proposal's `suggestedPractice` into a small learning ticket |
| Google Calendar | mcp-mediated | book a 30-minute practice slot for a lecture |
| Notion | mcp-mediated | append a weekly progress page to a learning journal |
| Slack | mcp-mediated | post a weekly digest to yourself |
| Lattice / Culture Amp / 15Five | mcp-mediated or api | same as Leapsome for other HR platforms |
| GitHub | api (read-only) | an optional signal source, not a sink — out of scope for this contract |

## Open questions

1. **Visibility.** Leapsome progress is likely visible to managers. Is it OK for Plum data (a self-coaching tool) to
   end up in a performance tool at all? Proposal: allowed, but opt-in per goal, with the visibility warning shown
   every time, and nothing synced without an explicit confirmation.
2. **Tool names.** Leapsome's MCP goal tools need to be recorded once by someone with access (see leapsome.md).
3. **Metric honesty.** Plum's domain scores currently saturate and the "verified" signal is mostly Claude's own
   behaviour (flagged in the first review). Goals built on those numbers inherit their weaknesses — worth fixing the
   skill model before syncing numbers into an HR tool, or restricting goals to habit metrics (predict/explain rates)
   and concepts completed, which are user actions.
4. **Where proposals come from.** Weakest domains only, or also concepts the user asked about but didn't finish?

## Proposed first slice

1. Core: `plum progress`, `plum goals propose|progress`, `plum connectors …` with consent and links (tested).
2. `plugin/connectors/leapsome/` manifest + instructions; `/plum:goals` and `/plum:connect` skills.
3. Evals: a proposal is shown before anything is sent; nothing is sent when the connector is disabled; payload has no
   paths or names.
