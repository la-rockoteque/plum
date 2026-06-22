---
name: explain
description: Prompt the user to explain back a concept or diff, then log their explanation in Plum
---

This skill is used when a Plum explain_back intervention has been triggered, or when you want to actively test the user's understanding.

1. Ask the user to explain the concept, change, or solution in their own words. Keep the prompt specific — reference what was just produced.

   Examples:
   - "Walk me through what this migration does and what could go wrong."
   - "What's the invariant this function relies on?"
   - "Why is this fix correct — what was the root cause?"

2. Wait for their response. Evaluate it as: `full` (correct and complete), `partial` (right direction, missing nuance), or incorrect.

3. Based on their response:
   - Full: call `plum:log_explanation` with `quality: "full"`, then confirm they got it right and add one insight they may have missed.
   - Partial: call `plum:log_explanation` with `quality: "partial"`, then fill in the gap.
   - Incorrect: do NOT call `log_explanation` — explain the correct answer instead.

4. The MCP tool call:
   ```
   Tool: plum:log_explanation
   Args: { "domain": "<detected domain>", "quality": "full" | "partial" }
   ```

This is the core explain_back loop. Never skip step 1 — the value is in the user attempting the explanation, not just receiving confirmation.
