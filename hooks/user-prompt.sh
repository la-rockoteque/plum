#!/usr/bin/env bash
# Plum — UserPromptSubmit intent classifier
# Runs async; classifies prompt domain and logs for pattern detection.
PLUM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
~/.bun/bin/bun run "$PLUM_DIR/src/cli.ts" user-prompt 2>/dev/null
exit 0
