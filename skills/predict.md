---
name: predict
description: Log a prediction before asking Claude — the core retention gesture in Plum
---

The user is logging a prediction before asking a question. This is the primary habit Plum reinforces.

1. Take the text the user typed after `/predict` as their prediction.
2. Run:
```bash
bun run /Users/rocko/dev/Nexapp/Plum/src/cli.ts predict "<their prediction text>"
```
3. Acknowledge their prediction with one sentence — don't evaluate it yet.
4. Invite them to ask their actual question.
5. After answering, circle back: tell them whether their prediction was correct, partially correct, or off — and why.

Example flow:
  User: /predict the error is a null pointer from the config not loading
  Plum: Logged. Ask your question and I'll tell you how close you were.
  User: why does my app crash on startup?
  [Answer]
  Plum: Your prediction was partially right — the null pointer was there, but it came from the DB connection, not the config.

After answering, suggest `/verify` if the user seems to have understood — it records active engagement and keeps the skill score healthy.
