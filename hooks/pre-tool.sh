#!/usr/bin/env bash
# Plum — PreToolUse observer + intervention injector
# Reads hook JSON from stdin; outputs coaching message if a cognitive pattern is detected.
PLUM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
~/.bun/bin/bun run "$PLUM_DIR/src/cli.ts" pre-tool 2>/dev/null
exit 0
