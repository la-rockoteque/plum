#!/usr/bin/env bash
# Plum — PostToolUse observer + skill score updater
# Runs async; logs outcome and updates skill model.
PLUM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
~/.bun/bin/bun run "$PLUM_DIR/src/cli.ts" post-tool 2>/dev/null
exit 0
