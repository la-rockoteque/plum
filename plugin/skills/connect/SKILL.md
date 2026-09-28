---
name: connect
description: Run a Plum connector (e.g. Leapsome) — create a goal or sync goal progress in another tool through the user's own connected MCP server, always showing the exact payload first. Use when the user wants Plum goals or progress in another tool, or asks to sync.
argument-hint: "<connector> [goals.create <proposalId> | goals.progress]"
---

Connectors live in `${CLAUDE_PLUGIN_ROOT}/connectors/<id>/`: `connector.json` (what it can do, what it sends, who
can see it) and `instructions.md` (how to call that tool's MCP). Plum never contacts the other tool itself — you do,
with the user's own connected MCP tools, only after they confirm.

```bash
P="${CLAUDE_PLUGIN_ROOT}/bin/plum"
"$P" connectors status <id>                 # on/off, what it needs, what it sends, visibility, linked goals
```

1. If the connector is **off**, stop and say how to turn it on (`"$P" connectors enable <id>`, personal config) —
   don't turn it on yourself unless the user just asked you to.
2. Read `${CLAUDE_PLUGIN_ROOT}/connectors/<id>/instructions.md` and follow it for the requested capability.
3. Always get the payload from Plum — `"$P" connectors payload <id> <capability> [proposalId]` — show it verbatim
   with its **Visibility** line, and ask for confirmation (AskUserQuestion). Send exactly those fields; nothing else.
4. If the tool's MCP isn't connected (no matching tools, or only `authenticate`), say so plainly and stop. Don't
   fall back to web requests, APIs or other tools.
5. After creating something, record it: `"$P" connectors link <id> <proposalId> <externalId>`.
6. Tell the user what was sent and where; never claim success you didn't see in the tool's result.
