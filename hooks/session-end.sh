#!/usr/bin/env bash
# Plum — SessionEnd finalizer
# Closes the session row and prints a brief delegation summary.
PLUM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
~/.bun/bin/bun run "$PLUM_DIR/src/cli.ts" session-end 2>/dev/null
exit 0
