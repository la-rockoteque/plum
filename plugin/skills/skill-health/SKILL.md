---
name: skill-health
description: Show Professor Plum skill radar — 5 domain scores and atrophy warnings
---

Run the following command and present the output verbatim (translate the labels if the user writes in another language), then add a one-sentence coaching note based on the lowest-scoring domain:

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/plum" skill-health
```

If any domain shows ⚠, remind the user to use `/plum:predict` before their next question in that domain.
