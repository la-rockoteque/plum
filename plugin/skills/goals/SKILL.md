---
name: goals
description: Turn what Plum measured into 1–3 personal growth goals (predicting before asking, explaining back, studying a concept) and, if the user wants, create them in a connected tool such as Leapsome. Use when the user asks about their progress, wants goals, or wants Plum data in Leapsome.
argument-hint: "[optional focus]"
---

```bash
P="${CLAUDE_PLUGIN_ROOT}/bin/plum"
```

1. **Show progress** — `"$P" progress` (habits, concepts studied, skill scores; counts only).
2. **Propose** — `"$P" goals propose`. Up to three measurable goals built from the user's own actions. Present them
   briefly and ask which to keep (AskUserQuestion, multiSelect; they may also edit the wording or decline all).
   Goals come from Plum's measurements only — don't invent others.
3. **Where to track them** — `"$P" connectors list`. If a connector is **on**, offer it; if one is **off**, mention
   it exists and that turning it on (`"$P" connectors enable <id>`) is their choice — never enable it for them
   without a clear yes. If none is wanted, the goals still count: Plum tracks them locally.
4. **Create** — for each chosen goal and chosen connector, follow `/plum:connect` for `goals.create`
   (show the exact payload and the visibility warning, confirm, send with the user's MCP tools, then link).
5. **Later** — `"$P" goals progress` shows how linked goals are doing; suggest a sync with `/plum:connect` at most weekly.

Never send anything without the user confirming the exact payload first.
