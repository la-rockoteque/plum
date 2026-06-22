---
name: verify
description: Mark that the user reviewed Claude's output — triggers a positive skill score update in Plum
---

The user is signalling that they reviewed, understood, or validated the output Claude just produced.

1. Run:
```bash
bun run /Users/rocko/dev/Nexapp/Plum/src/cli.ts verify
```

2. Acknowledge with one sentence confirming the verification was logged.

3. Optionally ask one brief engagement question based on what was just reviewed — e.g.:
   - For code: "What's the key invariant this change relies on?"
   - For a debug solution: "What was the root cause?"
   - For an architectural decision: "What would break this approach at scale?"

   This is optional — only ask if the conversation context makes it natural. Never repeat the question if the user already demonstrated understanding.

The goal is to make verification an active gesture, not just a checkbox.
