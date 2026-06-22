---
name: skill-health
description: Show Professor Plum skill radar — 5 domain scores and atrophy warnings
---

Run the following command and present the output verbatim, then add a one-sentence coaching note based on the lowest-scoring domain:

```bash
bun run /Users/rocko/dev/Nexapp/Plum/src/cli.ts skill-health
```

If any domain shows ⚠, remind the user to use `/predict` before their next question in that domain.
