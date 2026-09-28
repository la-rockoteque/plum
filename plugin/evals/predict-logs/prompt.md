---
description: /plum:predict logs the prediction and invites the real question without judging it yet
tags: [core, cheap]
runs: 1
max_turns: 6
allowed_tools: [Skill, Bash]
env:
  EVAL_PLUM_DATA_DIR: .plum-eval
---
/plum:predict the flaky test is a race condition in the cache warm-up
