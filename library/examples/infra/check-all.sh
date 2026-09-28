#!/usr/bin/env bash
# Runs every concept's check.sh; reports each result and fails if any failed.
set -u
cd "$(dirname "$0")"
failed=0
for check in */check.sh; do
  [ -e "$check" ] || { echo "no infra concepts yet"; exit 0; }
  if "./$check"; then echo "ok    ${check%/check.sh}"; else echo "FAIL  ${check%/check.sh}"; failed=1; fi
done
exit $failed
