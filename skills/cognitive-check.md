---
name: cognitive-check
description: Show Plum weekly delegation summary and intervention log
---

Run both commands and present a combined summary:

```bash
bun run /Users/rocko/dev/Nexapp/Plum/src/cli.ts status
bun run /Users/rocko/dev/Nexapp/Plum/src/cli.ts skill-health
```

Interpret the predict rate:
- ≥ 30%: healthy engagement
- 10–29%: encourage more predictions before asking
- < 10%: atrophy risk — suggest the user try `/predict` more often

Keep your commentary to 2–3 sentences.
